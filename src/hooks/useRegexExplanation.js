import { useState, useRef, useCallback } from 'react';
import { tauriAPI } from '../utils/tauriBridge';
import { getDefaultPrompts, loadAiSettings } from '../utils/aiSettings';

/**
 * AI 解释正则表达式 Hook
 * @param {Object} options
 * @param {function} options.t - 翻译函数
 * @param {string} options.lang - 当前语言
 * @returns {{ explain: function, isExplaining: boolean, explanation: string, abort: function, clear: function }}
 */
export function useRegexExplanation({ t, lang }) {
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const abortedRef = useRef(false);

  const explain = useCallback(async (regexStr) => {
    if (!regexStr?.trim()) return;

    const settings = loadAiSettings(lang);
    // 未配置 AI 则静默跳过
    if (!settings.baseUrl || !settings.apiKey || (!settings.explainModelName && !settings.regexModelName)) {
      return;
    }

    setIsExplaining(true);
    setExplanation('');
    abortedRef.current = false;

    try {
      const response = await tauriAPI.generateAiRegex({
        user_prompt: regexStr,
        system_prompt: settings.explainPrompt || getDefaultPrompts(lang).explainPrompt,
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model_name: settings.explainModelName || settings.regexModelName,
      });

      if (abortedRef.current) return;

      const result = response?.regex?.trim();
      if (result) {
        setExplanation(result);
      }
    } catch (error) {
      // 记录错误用于调试，但不影响主搜索流程
      console.error('Regex explanation failed:', error);
    } finally {
      setIsExplaining(false);
    }
  }, [lang]);

  const abort = useCallback(() => {
    abortedRef.current = true;
    setIsExplaining(false);
    setExplanation('');
  }, []);

  const clear = useCallback(() => {
    setExplanation('');
  }, []);

  return { explain, isExplaining, explanation, abort, clear };
}
