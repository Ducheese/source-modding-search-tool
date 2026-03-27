/**
 * i18n.js
 *
 * 国际化基础设施：Context、Provider 和 useLanguage hook。
 *
 * 用法：
 *   const { t, lang, setLang } = useLanguage();
 *
 *   t('app.switchToDark')                  // 静态字符串
 *   t('fileList.title', { count: 42 })     // 带插值（单括号 {key}）
 *
 * 插值规则：
 *   - 单括号 {key}      → 替换为 vars[key]
 *   - 双括号 {{context}} → 原样保留，不会被插值（用于提示词模板说明）
 *
 * 语言文件位置：public/lang/<langId>.txt（VDF KeyValues 格式）
 *
 * 语言检测优先级：
 *   1. localStorage['languagePreference']（用户手动选择）
 *   2. navigator.languages 系统语言
 *   3. fallback → english
 *
 * 若目标语言文件加载失败，自动降级到 english。
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { parseVdf } from './vdfParser';

// ─── 常量与映射 ──────────────────────────────────────────────────────────────

export const LANGUAGE_STORAGE_KEY = 'languagePreference';

export const SUPPORTED_LANGS = [
  { id: 'schinese', label: '简体中文' },
  { id: 'tchinese_hk', label: '繁體中文 (香港)' },
  { id: 'tchinese_tw', label: '繁體中文 (台灣)' },
  { id: 'english', label: 'English' },
  { id: 'russian', label: 'Русский' },
  { id: 'latam', label: 'Español (Latinoamérica)' },
  { id: 'brazilian', label: 'Português (Brasil)' },
  { id: 'indonesian', label: 'Bahasa Indonesia' },
  { id: 'vietnamese', label: 'Tiếng Việt' },
  { id: 'turkish', label: 'Türkçe' },
];

const BROWSER_TO_VALVE_MAP = {
  'zh-cn': 'schinese', 'zh-sg': 'schinese',
  'zh-tw': 'tchinese_tw', 'zh-hk': 'tchinese_hk', 'zh-mo': 'tchinese_hk',
  'ru': 'russian', 'es': 'latam', 'pt': 'brazilian',
  'id': 'indonesian', 'vi': 'vietnamese', 'tr': 'turkish', 'en': 'english',
};

const VALVE_TO_HTML_MAP = {
  schinese: 'zh-Hans', tchinese_hk: 'zh-Hant-HK', tchinese_tw: 'zh-Hant-TW', 
  english: 'en',
  russian: 'ru', latam: 'es-419', brazilian: 'pt-BR',
  indonesian: 'id', vietnamese: 'vi', turkish: 'tr'
};

// ─── 环境检测工具 ────────────────────────────────────────────────────────────

const isBrowser = typeof window !== 'undefined';

const safeGetLocalStorage = (key) => {
  if (!isBrowser) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetLocalStorage = (key, value) => {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

const safeGetNavigatorLanguages = () => {
  if (!isBrowser) return [];
  const langs = navigator.languages || (navigator.language ? [navigator.language] : []);
  // 过滤掉假值，避免 toLowerCase() 报错
  return langs.filter(Boolean);
};

const safeSetDocumentLang = (lang) => {
  if (!isBrowser) return;
  // 使用 ?? lang 避免"静默降级"到 'en'，让缺失映射显式暴露
  document.documentElement.lang = VALVE_TO_HTML_MAP[lang] ?? lang;
};

// ─── 语言检测 ────────────────────────────────────────────────────────────────

const detectBrowserLanguage = () => {
  // 1. 优先读取用户手动选择
  const stored = safeGetLocalStorage(LANGUAGE_STORAGE_KEY);
  if (stored && SUPPORTED_LANGS.some(l => l.id === stored)) return stored;

  // 2. 检测系统语言
  const browserLangs = safeGetNavigatorLanguages();
  for (const langTag of browserLangs) {
    const lowerTag = langTag.toLowerCase();
    if (BROWSER_TO_VALVE_MAP[lowerTag]) return BROWSER_TO_VALVE_MAP[lowerTag];

    if (lowerTag.includes('hant')) {
      return 'tchinese_tw';  // 默认走台湾
    }

    const prefix = lowerTag.split('-')[0];
    if (BROWSER_TO_VALVE_MAP[prefix]) return BROWSER_TO_VALVE_MAP[prefix];
  }

  // 3. 默认英语
  return 'english';
};

// ─── Context & Provider ──────────────────────────────────────────────────────

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  // 初始化时同步设置 document.lang，确保首屏一致性
  const [lang, setLangState] = useState(() => {
    const initial = detectBrowserLanguage();
    safeSetDocumentLang(initial);
    return initial;
  });
  const [langTokens, setLangTokens] = useState({});
  const [fallbackTokens, setFallbackTokens] = useState({});
  const langRef = useRef(lang);
  const abortControllerRef = useRef(null);

  // 1. 初始化加载 English 兜底包 (仅一次)
  useEffect(() => {
    const controller = new AbortController();

    fetch(`${process.env.PUBLIC_URL}/lang/english.txt`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => {
        const parsed = parseVdf(text);
        setFallbackTokens(parsed?.Tokens ?? {});
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error('[i18n] Failed to load english fallback:', err);
      });

    return () => controller.abort();
  }, []);

  // 2. 动态加载当前语言
  useEffect(() => {
    langRef.current = lang;
    safeSetDocumentLang(lang);

    // 【短路判断】如果当前是英语，直接清空 langTokens（t函数会自动走到 fallback）
    if (lang === 'english') {
      setLangTokens({});
      return;
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetch(`${process.env.PUBLIC_URL}/lang/${lang}.txt`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => {
        // 只在 lang 未变化时才更新（防止快速切换导致的竞态）
        if (langRef.current === lang) {
          const parsed = parseVdf(text);
          setLangTokens(parsed?.Tokens ?? {});
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.warn(`[i18n] Failed to load ${lang}.txt, using english:`, err);
        setLangTokens({});
      });

    return () => controller.abort();
  }, [lang]);

  const setLang = useCallback((newLang) => {
    if (SUPPORTED_LANGS.some(l => l.id === newLang)) {
      setLangState(newLang);
      safeSetLocalStorage(LANGUAGE_STORAGE_KEY, newLang);
      safeSetDocumentLang(newLang);
    }
  }, []);

  /**
   * 优化后的 t 函数
   * - 顺序：当前语言包 -> 英语包 -> Key
   * - 性能：使用 replace 的回调函数模式，单次正则完成所有占位符替换
   * - 安全：强制变量转换为字符串，处理 undefined/null
   * - 兼容：(?<!{){([^{}]+)}(?!}) 确保只替换 {count}，忽略 {{context}}
   */
  const t = useCallback((key, vars) => {
    const rawStr = langTokens[key] ?? fallbackTokens[key] ?? key;
    if (!vars) return rawStr;

    return rawStr.replace(/(?<!{){([^{}]+)}(?!})/g, (match, p1) => {
      const val = vars[p1];
      return (val !== undefined && val !== null) ? String(val) : match;
    });
  }, [langTokens, fallbackTokens]);

  const value = { t, lang, setLang, SUPPORTED_LANGS };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};
