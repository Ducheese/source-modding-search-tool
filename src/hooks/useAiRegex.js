import { useState, useRef, useCallback } from 'react';
import { tauriAPI } from '../utils/tauriBridge';
import { getDefaultPrompts, loadAiSettings } from '../utils/aiSettings';

/**
 * AI 生成正则表达式 Hook
 * @param {Object} options
 * @param {function} options.showSnackbar - 显示提示的函数
 * @param {function} options.t - 翻译函数
 * @param {string} options.lang - 当前语言
 * @returns {{ generate: function, isGenerating: boolean, abort: function }}
 */
export function useAiRegex({ showSnackbar, t, lang }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const abortedRef = useRef(false);

  const generate = useCallback(async (intent) => {
    if (!intent?.trim()) return null;

    const settings = loadAiSettings(lang);
    if (!settings.baseUrl || !settings.apiKey || !settings.regexModelName) {
      showSnackbar?.(t('search.aiConfigHint'), 'warning');
      return null;
    }

    setIsGenerating(true);
    abortedRef.current = false;

    try {
      const response = await tauriAPI.generateAiRegex({
        user_prompt: intent,
        system_prompt: settings.regexPrompt || getDefaultPrompts(lang).regexPrompt,
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model_name: settings.regexModelName,
      });

      // 如果已中断，丢弃结果
      if (abortedRef.current) return null;

      const regex = response?.regex?.trim();
      if (!regex) {
        showSnackbar?.(t('search.noRegex'), 'error');
        return null;
      }

      return regex;
    } catch (error) {
      if (abortedRef.current) return null;
      showSnackbar?.(t('search.timeout'), 'error');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [lang, showSnackbar, t]);

  const abort = useCallback(() => {
    abortedRef.current = true;
    setIsGenerating(false);
  }, []);

  return { generate, isGenerating, abort };
}
