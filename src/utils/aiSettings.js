import { AI_SETTINGS_STORAGE_KEY } from '../config/storageKeys';
import {
  CHINESE_LANGS,
  DEFAULT_AI_REGEX_PROMPT,
  DEFAULT_AI_CHAT_PROMPT,
  DEFAULT_AI_EXPLAIN_PROMPT,
  DEFAULT_AI_REGEX_PROMPT_ZH,
  DEFAULT_AI_CHAT_PROMPT_ZH,
  DEFAULT_AI_EXPLAIN_PROMPT_ZH,
} from '../config/aiDefaults';

/**
 * 根据当前语言返回对应的三份默认提示词。
 * @param {string} [lang] - 来自 i18n 的语言 ID，例如 'schinese'、'english'
 * @returns {{ regexPrompt: string, chatPrompt: string, explainPrompt: string }}
 */
export const getDefaultPrompts = (lang) => {
  if (lang && CHINESE_LANGS.includes(lang)) {
    return {
      regexPrompt:   DEFAULT_AI_REGEX_PROMPT_ZH,
      chatPrompt:    DEFAULT_AI_CHAT_PROMPT_ZH,
      explainPrompt: DEFAULT_AI_EXPLAIN_PROMPT_ZH,
    };
  }
  return {
    regexPrompt:   DEFAULT_AI_REGEX_PROMPT,
    chatPrompt:    DEFAULT_AI_CHAT_PROMPT,
    explainPrompt: DEFAULT_AI_EXPLAIN_PROMPT,
  };
};

export const loadAiSettings = (lang) => {
  const defaults = getDefaultPrompts(lang);
  
  // SSR 兼容性检查
  if (typeof window === 'undefined') {
    return {
      baseUrl: '',
      apiKey: '',
      regexModelName: '',
      chatModelName: '',
      explainModelName: '',
      regexPrompt:   defaults.regexPrompt,
      chatPrompt:    defaults.chatPrompt,
      explainPrompt: defaults.explainPrompt,
    };
  }
  
  const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return {
      baseUrl: '',
      apiKey: '',
      regexModelName: '',
      chatModelName: '',
      explainModelName: '',
      regexPrompt:   defaults.regexPrompt,
      chatPrompt:    defaults.chatPrompt,
      explainPrompt: defaults.explainPrompt,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      baseUrl: parsed.baseUrl || '',
      apiKey: parsed.apiKey || '',
      regexModelName: parsed.regexModelName || '',
      chatModelName: parsed.chatModelName || '',
      explainModelName: parsed.explainModelName || '',
      regexPrompt:   parsed.regexPrompt   || defaults.regexPrompt,
      chatPrompt:    parsed.chatPrompt    || defaults.chatPrompt,
      explainPrompt: parsed.explainPrompt || defaults.explainPrompt,
    };
  } catch (error) {
    return {
      baseUrl: '',
      apiKey: '',
      regexModelName: '',
      chatModelName: '',
      explainModelName: '',
      regexPrompt:   defaults.regexPrompt,
      chatPrompt:    defaults.chatPrompt,
      explainPrompt: defaults.explainPrompt,
    };
  }
};
