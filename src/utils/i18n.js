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

// ─── 常量 ────────────────────────────────────────────────────────────────────

export const LANGUAGE_STORAGE_KEY = 'languagePreference';

export const SUPPORTED_LANGS = [
  { id: 'schinese', label: '简体中文' },
  { id: 'tchinese', label: '繁體中文' },
  { id: 'english',  label: 'English'  },
];

// ─── 语言检测 ────────────────────────────────────────────────────────────────

function detectSystemLang() {
  const supported = SUPPORTED_LANGS.map(l => l.id);
  const navLangs = Array.from(navigator.languages || [navigator.language || '']);

  for (const raw of navLangs) {
    const lower = raw.toLowerCase();
    if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-mo')) {
      // 繁体中文：若支持则选 tchinese，否则降级 schinese
      if (supported.includes('tchinese')) return 'tchinese';
      if (supported.includes('schinese')) return 'schinese';
    }
    if (lower.startsWith('zh')) {
      if (supported.includes('schinese')) return 'schinese';
    }
  }
  return 'english';
}

function resolveInitialLang() {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  const supported = SUPPORTED_LANGS.map(l => l.id);
  if (saved && supported.includes(saved)) return saved;
  const detected = detectSystemLang();
  return supported.includes(detected) ? detected : 'english';
}

// ─── Context ─────────────────────────────────────────────────────────────────

const LanguageContext = createContext(null);

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const initial = resolveInitialLang();
    const htmlLangMap = { schinese: 'zh-Hans', tchinese: 'zh-Hant', english: 'en' };
    document.documentElement.lang = htmlLangMap[initial] ?? initial;
    return initial;
  });

  // fallbackTokens: english 永远作为 fallback
  const [fallbackTokens, setFallbackTokens] = useState({});
  // langTokens: 当前语言的 tokens（english 时为空，直接走 fallback）
  const [langTokens, setLangTokens] = useState({});

  // 用于在 effect 中读取最新 lang，不触发重渲染
  const langRef = useRef(lang);
  langRef.current = lang;

  // 始终加载 english 作为 fallback
  useEffect(() => {
    fetch('/lang/english.txt')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => {
        const parsed = parseVdf(text);
        setFallbackTokens(parsed?.Tokens ?? {});
      })
      .catch(err => console.error('[i18n] Failed to load english.txt:', err));
  }, []);

  // 加载当前语言（english 本身不需要加载，走 fallback 即可）
  useEffect(() => {
    if (lang === 'english') {
      setLangTokens({});
      return;
    }
    fetch(`/lang/${lang}.txt`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => {
        // 只在 lang 未变化时才更新（防止快速切换导致的竞态）
        if (langRef.current === lang) {
          const parsed = parseVdf(text);
          setLangTokens(parsed?.Tokens ?? {});
        }
      })
      .catch(err => {
        console.warn(`[i18n] Failed to load ${lang}.txt, falling back to english:`, err);
        setLangTokens({});
      });
  }, [lang]);

  // 切换语言
  const setLang = useCallback((newLang) => {
    const supported = SUPPORTED_LANGS.map(l => l.id);
    if (!supported.includes(newLang)) return;
    setLangState(newLang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    // 同步 <html lang> 供屏幕阅读器和浏览器感知
    const htmlLangMap = { schinese: 'zh-Hans', tchinese: 'zh-Hant', english: 'en' };
    document.documentElement.lang = htmlLangMap[newLang] ?? newLang;
  }, []);

  /**
   * t(key, vars?)
   *
   * 查找顺序：当前语言 → english fallback → key 本身（兜底）
   * 插值：单括号 {key} 替换，双括号 {{key}} 原样保留
   */
  const t = useCallback((key, vars) => {
    const str = langTokens[key] ?? fallbackTokens[key] ?? key;
    if (!vars) return str;

    // 负向前瞻/后顾：跳过 {{ }} 包裹的双括号
    return str.replace(/(?<!\{)\{(\w+)\}(?!\})/g, (_, k) => {
      const val = vars[k];
      return val !== undefined ? String(val) : `{${k}}`;
    });
  }, [langTokens, fallbackTokens]);

  const value = {
    t,
    lang,
    setLang,
    SUPPORTED_LANGS,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
