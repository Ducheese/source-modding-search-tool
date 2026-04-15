import { useState, useCallback, useEffect } from 'react';
import { AI_SETTINGS_STORAGE_KEY } from '../config/storageKeys';
import { getDefaultPrompts, loadAiSettings } from '../utils/aiSettings';
import { tauriAPI } from '../utils/tauriBridge';

/**
 * AI 设置状态管理 Hook
 * @param {Object} options
 * @param {string} options.lang - 当前语言
 * @param {boolean} options.open - 对话框是否打开（用于在打开时重新加载设置）
 * @param {function} options.showSnackbar - 显示提示的函数
 * @param {function} options.t - 翻译函数
 * @returns {{ settings: object, setField: function, resetPrompts: function, testConnection: function, isTesting: boolean }}
 */
export function useAiSettings({ lang, open, showSnackbar, t } = {}) {
  const [settings, setSettings] = useState(() => loadAiSettings(lang));
  const [isTesting, setIsTesting] = useState(false);

  // 对话框打开时重新加载设置（响应语言变化等）
  useEffect(() => {
    if (open) {
      setSettings(loadAiSettings(lang));
    }
  }, [open, lang]);

  const setField = useCallback((field, value) => {
    setSettings(prev => {
      const next = { ...prev, [field]: value };
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetPrompts = useCallback(() => {
    const defaults = getDefaultPrompts(lang);
    setField('regexPrompt', defaults.regexPrompt);
    setField('chatPrompt', defaults.chatPrompt);
    setField('explainPrompt', defaults.explainPrompt);
  }, [lang, setField]);

  const testConnection = useCallback(async () => {
    if (!settings.baseUrl?.trim() || !settings.apiKey?.trim() || 
        (!settings.regexModelName?.trim() && !settings.chatModelName?.trim() && !settings.explainModelName?.trim())) {
      showSnackbar?.(t('help.fillRequired'), 'warning');
      return false;
    }

    setIsTesting(true);
    try {
      await tauriAPI.testAiConnection({
        user_prompt: 'Reply with OK only',
        system_prompt: 'You are a test assistant. Reply directly with what the user requests, no extra information.',
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model_name: settings.regexModelName || settings.chatModelName || settings.explainModelName,
      });
      showSnackbar?.(t('help.connectionSuccess'), 'success');
      return true;
    } catch {
      showSnackbar?.(t('help.connectionFailed'), 'error');
      return false;
    } finally {
      setIsTesting(false);
    }
  }, [settings, showSnackbar, t]);

  return { settings, setField, resetPrompts, testConnection, isTesting };
}
