/**
 * LanguageContext.js
 *
 * 国际化 Context、Provider 和 useLanguage hook。
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
import { parseVdf } from '../utils/vdfParser';
import { SUPPORTED_LANGS } from '../config/languages';
import { LANGUAGE_STORAGE_KEY } from '../config/storageKeys';
import {
  detectBrowserLanguage,
  safeSetDocumentLang,
  safeSetLocalStorage,
} from '../utils/i18n';

// ─── Context & Provider ──────────────────────────────────────────────────────

// 插值正则：匹配 {key} 但忽略 {{context}}
// 提升到模块顶层，避免每次 t() 调用都重新编译
const INTERPOLATION_RE = /(?<!{){([^{}]+)}(?!})/g;

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  // 初始化时同步设置 document.lang，确保首屏一致性
  const [lang, setLangState] = useState(() => {
    const initial = detectBrowserLanguage();
    safeSetDocumentLang(initial);
    return initial;
  });
  // loadedLang: 表示目标语言包已加载完成，用于精确判断语言切换时机
  const [loadedLang, setLoadedLang] = useState(() => {
    const initial = detectBrowserLanguage();
    return initial === 'english' ? 'english' : null; // 英语不需要加载，直接就绪
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
      setLoadedLang('english');
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
          setLoadedLang(lang); // 标记目标语言已加载完成
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.warn(`[i18n] Failed to load ${lang}.txt, using english:`, err);
        setLangTokens({});
        // 加载失败时 fallback 到英语，loadedLang 应反映实际生效的语言
        if (langRef.current === lang) {
          setLoadedLang('english');
        }
      });

    return () => controller.abort();
  }, [lang]);

  const setLang = useCallback((newLang) => {
    if (SUPPORTED_LANGS.some(l => l.id === newLang)) {
      // 不重置 loadedLang，让旧语言继续显示直到新语言加载完成
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

    return rawStr.replace(INTERPOLATION_RE, (match, p1) => {
      const val = vars[p1];
      return (val !== undefined && val !== null) ? String(val) : match;
    });
  }, [langTokens, fallbackTokens]);

  const value = { t, lang, setLang, SUPPORTED_LANGS, loadedLang };

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
