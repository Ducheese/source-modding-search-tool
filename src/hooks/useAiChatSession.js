import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { tauriAPI } from '../utils/tauriBridge';
import { getDefaultPrompts, loadAiSettings } from '../utils/aiSettings';
import { parseThinkChunk } from '../utils/parseThinkChunk';
import { serializeResultsForAi } from '../utils/chatContextSerializer';

const STREAM_EVENT = 'ai-chat-stream';

/**
 * 格式化时间戳
 */
const formatTimestamp = (date) => {
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * AI 对话会话管理 Hook
 * 包含消息状态、SSE 监听、请求管理
 * @param {Object} options
 * @param {Object} options.results - 搜索结果
 * @param {string} options.lang - 当前语言
 * @param {function} options.t - 翻译函数
 * @param {function} options.showSnackbar - 显示提示
 * @returns {{ messages, isStreaming, sendMessage, resetSession, toggleThink, contextPrompt }}
 */
export function useAiChatSession({ results, lang, t, showSnackbar }) {
  // 状态
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(4096);

  // Refs（用于事件回调中访问最新值）
  const messagesRef = useRef([]);
  const throttleTimerRef = useRef(null);
  const activeRequestRef = useRef(null);
  const requestMetaRef = useRef(new Map());
  const contextPromptRef = useRef('');

  // 生成上下文提示（给 AI 用）
  const contextPrompt = useMemo(() => {
    if (!results?.files?.length) return '';
    return serializeResultsForAi(results);
  }, [results]);

  // 更新 contextPromptRef
  useEffect(() => {
    contextPromptRef.current = contextPrompt;
  }, [contextPrompt]);

  // 节流刷新
  const scheduleThrottledUpdate = useCallback(() => {
    if (throttleTimerRef.current) return;
    throttleTimerRef.current = setTimeout(() => {
      throttleTimerRef.current = null;
      setMessages([...messagesRef.current]);
    }, 60);
  }, []);

  const cancelPendingUpdate = useCallback(() => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
  }, []);

  // SSE 事件监听
  useEffect(() => {
    const unlistenPromise = listen(STREAM_EVENT, (event) => {
      const payload = event.payload;
      const { requestId } = payload ?? {};
      
      // 过滤非当前请求的事件
      if (!requestId || requestId !== activeRequestRef.current) return;
      
      const meta = requestMetaRef.current.get(requestId);
      if (!meta) return;

      // 错误处理
      if (payload.error) {
        const nextMessages = messagesRef.current.map((m) => {
          if (m.id !== meta.messageId) return m;
          return { ...m, streaming: false, content: `**Error:** ${payload.error}` };
        });
        messagesRef.current = nextMessages;
        cancelPendingUpdate();
        setIsStreaming(false);
        setMessages(nextMessages);
        showSnackbar?.(payload.error, 'error');
        return;
      }

      // 流式内容 delta
      if (payload.delta) {
        const { content, reasoning } = payload.delta;
        if (!content && !reasoning) return;

        const nextMessages = messagesRef.current.map((m) => {
          if (m.id !== meta.messageId) return m;
          let updated = m;
          if (content) updated = parseThinkChunk(updated, content);
          if (reasoning) updated = { ...updated, reasoningRaw: (updated.reasoningRaw || '') + reasoning };
          return { ...updated, updatedAt: Date.now() };
        });
        messagesRef.current = nextMessages;
        scheduleThrottledUpdate();
      }

      // 流结束
      if (payload.done) {
        const usage = payload.usage ?? {};
        const promptTokens = usage.prompt_tokens ?? 0;
        const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
        const completionTokens = usage.completion_tokens ?? 0;
        const duration = (Date.now() - meta.startTime) / 1000;
        const tokenSpeed = duration > 0 ? completionTokens / duration : 0;

        const nextMessages = messagesRef.current.map((m) => {
          if (m.id !== meta.messageId) return m;
          return {
            ...m,
            streaming: false,
            thinkCollapsed: true,
            metrics: { promptTokens, cachedTokens, completionTokens, tokenSpeed, duration },
          };
        });
        
        messagesRef.current = nextMessages;
        cancelPendingUpdate();
        setIsStreaming(false);
        setMessages(nextMessages);
      }
    });

    return () => {
      cancelPendingUpdate();
      unlistenPromise.then((fn) => fn()).catch(() => {});
    };
  }, [cancelPendingUpdate, scheduleThrottledUpdate, showSnackbar]);

  // 重置会话
  const resetSession = useCallback(() => {
    const settings = loadAiSettings(lang);
    const hasContext = (settings.chatPrompt || getDefaultPrompts(lang).chatPrompt).includes('{{context}}');
    const contextNotice = {
      id: `context-${Date.now()}`,
      role: 'info',
      content: hasContext ? 'aiChat.contextMounted' : 'aiChat.noContext',
      createdAt: formatTimestamp(new Date()),
    };
    messagesRef.current = [contextNotice];
    setMessages([contextNotice]);
    setIsStreaming(false);
    activeRequestRef.current = null;
    requestMetaRef.current.clear();
  }, [lang]);

  // 发送消息
  const sendMessage = useCallback(async (content, { enableThinking: thinking, thinkingBudget: budget } = {}) => {
    if (isStreaming || !content?.trim()) return;

    const settings = loadAiSettings(lang);
    if (!settings.baseUrl || !settings.apiKey || (!settings.chatModelName && !settings.regexModelName)) {
      showSnackbar?.(t('aiChat.aiConfigHint'), 'warning');
      return;
    }

    const now = new Date();
    const userMessage = {
      id: `user-${now.getTime()}`,
      role: 'user',
      content,
      createdAt: formatTimestamp(now),
    };
    const assistantId = `assistant-${now.getTime()}`;
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      thinkContent: '',
      parseMode: 'text',
      parseBuffer: '',
      reasoningRaw: '',
      createdAt: formatTimestamp(now),
      modelName: settings.chatModelName || settings.regexModelName,
      streaming: true,
      thinkCollapsed: false,
    };

    const nextMessages = [...messagesRef.current, userMessage, assistantMessage];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setIsStreaming(true);

    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeRequestRef.current = requestId;
    requestMetaRef.current.set(requestId, { messageId: assistantId, startTime: Date.now() });

    // 构建消息历史
    const chatPrompt = (settings.chatPrompt || getDefaultPrompts(lang).chatPrompt)
      .replace('{{context}}', contextPromptRef.current);

    const chatMessages = [
      { role: 'system', content: chatPrompt },
      ...nextMessages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.streaming)
        .map((m) => ({ role: m.role, content: m.content || '' })),
    ];

    try {
      await tauriAPI.streamAiChat({
        messages: chatMessages,
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model_name: settings.chatModelName || settings.regexModelName,
        request_id: requestId,
        enable_thinking: thinking ?? enableThinking,
        thinking_budget: budget ?? thinkingBudget,
      });
    } catch {
      const updatedMessages = messagesRef.current.map((m) => {
        if (m.id !== assistantId) return m;
        return { ...m, streaming: false, content: `**Error:** ${t('aiChat.startFailed')}` };
      });
      messagesRef.current = updatedMessages;
      setMessages(updatedMessages);
      setIsStreaming(false);
      showSnackbar?.(t('aiChat.startFailed'), 'error');
    }
  }, [isStreaming, lang, showSnackbar, t, enableThinking, thinkingBudget]);

  // 切换思考折叠
  const toggleThink = useCallback((messageId) => {
    const nextMessages = messagesRef.current.map((m) =>
      m.id === messageId ? { ...m, thinkCollapsed: !m.thinkCollapsed } : m
    );
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }, []);

  // 关闭时 finalize streaming 消息
  const finalizeStreaming = useCallback(() => {
    const hadStreaming = messagesRef.current.some(m => m.streaming);
    if (hadStreaming) {
      const nextMessages = messagesRef.current.map((m) => {
        if (!m.streaming) return m;
        return { ...m, streaming: false, content: m.content || '**Interrupted**' };
      });
      messagesRef.current = nextMessages;
      setIsStreaming(false);
    }
    activeRequestRef.current = null;
  }, []);

  return {
    messages,
    isStreaming,
    enableThinking,
    thinkingBudget,
    setEnableThinking,
    setThinkingBudget,
    sendMessage,
    resetSession,
    toggleThink,
    finalizeStreaming,
    contextPrompt,
  };
}
