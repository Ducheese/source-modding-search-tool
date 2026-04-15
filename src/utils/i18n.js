/**
 * i18n 工具函数
 */

import { LANGUAGE_STORAGE_KEY } from '../config/storageKeys';
import { SUPPORTED_LANGS, BROWSER_TO_VALVE_MAP, VALVE_TO_HTML_MAP } from '../config/languages';

// ─── 环境检测工具 ────────────────────────────────────────────────────────────

const isBrowser = typeof window !== 'undefined';

export const safeGetLocalStorage = (key) => {
  if (!isBrowser) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeSetLocalStorage = (key, value) => {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

export const safeGetNavigatorLanguages = () => {
  if (!isBrowser) return [];
  const langs = navigator.languages || (navigator.language ? [navigator.language] : []);
  // 过滤掉假值，避免 toLowerCase() 报错
  return langs.filter(Boolean);
};

export const safeSetDocumentLang = (lang) => {
  if (!isBrowser) return;
  // 使用 ?? lang 避免"静默降级"到 'en'，让缺失映射显式暴露
  document.documentElement.lang = VALVE_TO_HTML_MAP[lang] ?? lang;
};

// ─── 语言检测 ────────────────────────────────────────────────────────────────

export const detectBrowserLanguage = () => {
  // 1. 优先读取用户手动选择
  const stored = safeGetLocalStorage(LANGUAGE_STORAGE_KEY);
  if (stored && SUPPORTED_LANGS.some(l => l.id === stored)) return stored;

  // 2. 检测系统语言
  const browserLangs = safeGetNavigatorLanguages();
  for (const langTag of browserLangs) {
    const lowerTag = langTag.toLowerCase();
    if (BROWSER_TO_VALVE_MAP[lowerTag]) return BROWSER_TO_VALVE_MAP[lowerTag];

    const prefix = lowerTag.split('-')[0];
    if (BROWSER_TO_VALVE_MAP[prefix]) return BROWSER_TO_VALVE_MAP[prefix];
  }

  // 3. 默认英语
  return 'english';
};