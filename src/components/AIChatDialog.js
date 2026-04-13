import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Fab,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
  TextField,
  alpha,
  useTheme,
} from '@mui/material';
import { Close, ExpandLess, ExpandMore, Lightbulb, Remove, Send, SmartToy } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSnackbar } from '../App';
import { getDefaultPrompts, loadAiSettings } from '../utils/aiDefaults';
import { formatResultsForExport } from '../utils/searchEngine';
import { tauriAPI } from '../utils/tauriBridge';
import { listen } from '@tauri-apps/api/event';
import { getMarkdownStyles } from '../utils/markdownStyles';
import { useLanguage } from '../utils/i18n';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const STREAM_EVENT = 'ai-chat-stream';

// ─── 工具函数（组件外，不参与渲染循环）─────────────────────────────────────

const formatTimestamp = (date) => {
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * 将一个流式 chunk 解析进消息对象，支持 <think>...</think> 标签。
 *
 * 实现为状态机，有两种 mode：'text' | 'think'。
 * 遇到不完整的标签前缀时（如 "<thi"），停止处理并将剩余存入 buffer 等下一个 chunk。
 *
 * 优化点：先用 indexOf('<') 跳过纯文本段，避免逐字符迭代（对长思考链有 5~10x 加速）。
 */
const parseThinkChunk = (message, chunk) => {
  const OPEN  = '<think>';
  const CLOSE = '</think>';
  const state = {
    content:      message.content      || '',
    thinkContent: message.thinkContent || '',
    mode:         message.parseMode    || 'text',
  };

  let buffer = (message.parseBuffer || '') + chunk;
  let index  = 0;

  while (index < buffer.length) {
    // 跳跃优化：找到下一个 '<' 之前的文本一次性追加
    const nextAngle = buffer.indexOf('<', index);
    if (nextAngle === -1) {
      // 剩余全是普通文本
      const tail = buffer.slice(index);
      if (state.mode === 'think') state.thinkContent += tail;
      else                        state.content      += tail;
      index = buffer.length;
      break;
    }

    // 把 [index, nextAngle) 的普通文本先追加
    if (nextAngle > index) {
      const plain = buffer.slice(index, nextAngle);
      if (state.mode === 'think') state.thinkContent += plain;
      else                        state.content      += plain;
      index = nextAngle;
    }

    // 现在 index 指向 '<'，处理可能的标签
    const remaining = buffer.slice(index);
    if (remaining.startsWith(OPEN)) {
      state.mode = 'think';
      index += OPEN.length;
    } else if (remaining.startsWith(CLOSE)) {
      state.mode = 'text';
      index += CLOSE.length;
    } else if (OPEN.startsWith(remaining) || CLOSE.startsWith(remaining)) {
      // 不完整的标签前缀，停下来等下一个 chunk
      break;
    } else {
      // 普通的 '<'（如 HTML 实体、数学公式等）
      if (state.mode === 'think') state.thinkContent += '<';
      else                        state.content      += '<';
      index += 1;
    }
  }

  return {
    ...message,
    content:      state.content,
    thinkContent: state.thinkContent,
    parseMode:    state.mode,
    parseBuffer:  buffer.slice(index),
  };
};

// ─── 子组件（用 React.memo 避免已完成消息的重复渲染）────────────────────────

/**
 * Markdown 渲染单元。
 * 抽成独立组件 + memo，确保 content 未变化时不重新解析 Markdown。
 */
const MarkdownContent = React.memo(({ content, styles }) => (
  <Box sx={styles}>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  </Box>
));

/**
 * 思考过程折叠块。
 */
const ThinkBlock = React.memo(({ thinkText, collapsed, onToggle }) => {
  const { t } = useLanguage();
  if (!thinkText) return null;
  return (
    <Box sx={{ mb: 1 }}>
      <Box
        onClick={onToggle}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          color: 'text.secondary',
          userSelect: 'none',
        }}
      >
        {collapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
        <Typography variant="caption">{t('aiChat.thinkProcess')}</Typography>
      </Box>
      <Collapse in={!collapsed} timeout="auto" unmountOnExit>
        <Box
          sx={(theme) => ({
            mt: 0.5,
            p: '8px 12px',
            borderRadius: 1,
            bgcolor: alpha(theme.palette.text.secondary, 0.08),
          })}
        >
          <Typography
            variant="caption"
            sx={{ whiteSpace: 'pre-line', lineHeight: 1.5, display: 'block', color: 'text.secondary' }}
          >
            {thinkText}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
});

/**
 * Token 用量与速度指标行。
 */
const MessageMetrics = React.memo(({ metrics }) => {
  const { t } = useLanguage();
  if (!metrics) return null;
  const { promptTokens, cachedTokens, completionTokens, tokenSpeed, duration } = metrics;
  const cachedSuffix = cachedTokens ? t('aiChat.cachedSuffix', { n: cachedTokens }) : '';
  return (
    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
      {t('aiChat.inputTok', { prompt: promptTokens, cached: cachedSuffix })}
      {' | '}{t('aiChat.outputTok', { n: completionTokens })}
      {' | '}{t('aiChat.speed', { speed: tokenSpeed.toFixed(1) })}
      {' | '}{t('aiChat.duration', { duration: duration.toFixed(1) })}
    </Typography>
  );
});

// ─── 主组件 ──────────────────────────────────────────────────────────────────

const AIChatDialog = ({ open, onClose, results, minimized, onMinimizedChange, isAtBottom }) => {
  const theme       = useTheme();
  const showSnackbar = useSnackbar();
  const { t, lang } = useLanguage();

  // ── State ──
  const [messages,   setMessages]   = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(4096);

  // ── Refs（用于事件回调中访问最新值，避免 stale closure）──
  const messagesRef       = useRef([]);   // 消息列表的 source of truth
  const scrollRef         = useRef(null); // 消息列表的 DOM 节点
  const throttleTimerRef  = useRef(null); // 节流计时器（非防抖！）
  const activeRequestRef  = useRef(null); // 当前进行中的 requestId
  const requestMetaRef    = useRef(new Map()); // requestId → { messageId, startTime }
  const contextPromptRef  = useRef('');   // 搜索结果上下文文本（稳定引用）
  const prevOpenRef       = useRef(open); // 跟踪 open 的前一个值，避免语言切换时重置 minimized

  const markdownStyles = useMemo(() => getMarkdownStyles(theme), [theme]);

  // ─── Callbacks ─────────────────────────────────────────────────────────────

  /**
   * 节流刷新：在 60ms 窗口内最多触发一次 setMessages。
   * 流式场景下「节流」比「防抖」更合适——防抖会憋到最后才渲染，体验差。
   */
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

  /** 打开对话框时：重置所有状态，准备好上下文 */
  const resetDialogState = useCallback(() => {
    const settings = loadAiSettings(lang); // 添加这一行
    const hasContext = (settings.chatPrompt || getDefaultPrompts(lang).chatPrompt).includes('{{context}}');
    const contextNotice = {
      id: `context-${Date.now()}`,
      role: 'info',
      content: hasContext ? 'aiChat.contextMounted' : 'aiChat.noContext',  // stored as key, translated at render time
      createdAt: formatTimestamp(new Date()),
    };
    messagesRef.current = [contextNotice];
    setMessages([contextNotice]);
    setInputValue('');
    setIsStreaming(false);
    activeRequestRef.current = null;
    requestMetaRef.current.clear();

    try {
      contextPromptRef.current = formatResultsForExport(results, 'md', t);
    } catch {
      contextPromptRef.current = '';
    }
  }, [results, t, lang]);

  // ─── Effects ───────────────────────────────────────────────────────────────

  // 打开/关闭对话框时的副作用
  // 注意：只在 open 从 false 变为 true 时才重置状态，避免语言切换等导致的重渲染重置 minimized
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (open && !wasOpen) {
      // 对话框刚打开 → 重置状态
      onMinimizedChange(false);
      resetDialogState();
    } else if (!open) {
      // 对话框关闭 → 清理
      onMinimizedChange(false);
      activeRequestRef.current = null;

      // 如果有正在 streaming 的消息，finalize 它们
      const hadStreaming = messagesRef.current.some(m => m.streaming);
      if (hadStreaming) {
        const nextMessages = messagesRef.current.map((m) => {
          if (!m.streaming) return m;
          return {
            ...m,
            streaming: false,
            content: m.content || '**Interrupted**',
          };
        });
        messagesRef.current = nextMessages;
        setIsStreaming(false);
        // 不需要 setMessages，因为对话框已关闭，下次打开时会 resetDialogState
      }
    }
    // 如果 open 保持 true（如语言切换导致的重渲染），不做任何操作，保留 minimized 状态
  }, [open, resetDialogState, onMinimizedChange]);

  // 监听来自 Rust 后端的 SSE 流式事件
  useEffect(() => {
    const unlistenPromise = listen(STREAM_EVENT, (event) => {
      const payload = event.payload;

      // 过滤：只处理属于当前请求的事件
      const { requestId } = payload ?? {};
      if (!requestId || requestId !== activeRequestRef.current) return;

      const meta = requestMetaRef.current.get(requestId);
      if (!meta) return;

      // 后端报错
      if (payload.error) {
        // 正确 finalize 那条 assistant message，而不是留下空消息
        const nextMessages = messagesRef.current.map((m) => {
          if (m.id !== meta.messageId) return m;
          return {
            ...m,
            streaming: false,
            content: `**Error:** ${payload.error}`,
          };
        });
        messagesRef.current = nextMessages;
        cancelPendingUpdate();
        setIsStreaming(false);
        setMessages(nextMessages);
        showSnackbar(payload.error, 'error');
        return;
      }

      // 流式内容 delta
      if (payload.delta) {
        const { content, reasoning } = payload.delta;
        if (!content && !reasoning) return;

        const nextMessages = messagesRef.current.map((m) => {
          if (m.id !== meta.messageId) return m;
          let updated = m;
          if (content)           updated = parseThinkChunk(updated, content);
          if (reasoning) updated = { ...updated, reasoningRaw: (updated.reasoningRaw || '') + reasoning };
          return { ...updated, updatedAt: Date.now() };
        });
        messagesRef.current = nextMessages;
        scheduleThrottledUpdate();
      }

      // 流结束
      if (payload.done) {
        const usage = payload.usage ?? {};
        const promptTokens     = usage.prompt_tokens ?? 0;
        const cachedTokens     = usage.prompt_tokens_details?.cached_tokens ?? 0;
        const completionTokens = usage.completion_tokens ?? 0;
        const duration         = (Date.now() - meta.startTime) / 1000;
        const tokenSpeed       = duration > 0 ? completionTokens / duration : 0;

        const nextMessages = messagesRef.current.map((m) => {
          if (m.id !== meta.messageId) return m;
          return {
            ...m,
            streaming:     false,
            thinkCollapsed: true,
            metrics: { promptTokens, cachedTokens, completionTokens, tokenSpeed, duration },
          };
        });
        // 先更新 ref，再取消节流，再 setState（顺序不能乱）
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

  // 自动滚动：只在用户"接近底部"时触发，不强制打断用户的上翻操作
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // ─── 事件处理器 ────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (isStreaming) return;
    const content = inputValue.trim();
    if (!content) return;

    const settings = loadAiSettings(lang);
    if (!settings.baseUrl || !settings.apiKey || (!settings.chatModelName && !settings.regexModelName)) {
      showSnackbar(t('aiChat.aiConfigHint'), 'warning');
      return;
    }

    const now = new Date();
    const userMessage = {
      id:        `user-${now.getTime()}`,
      role:      'user',
      content,
      createdAt: formatTimestamp(now),
    };
    const assistantId = `assistant-${now.getTime()}`;
    const assistantMessage = {
      id:            assistantId,
      role:          'assistant',
      content:       '',
      thinkContent:  '',
      parseMode:     'text',
      parseBuffer:   '',
      reasoningRaw:  '',
      createdAt:     formatTimestamp(now),
      modelName:     settings.chatModelName || settings.regexModelName,
      streaming:     true,
      thinkCollapsed: false,
    };

    const nextMessages = [...messagesRef.current, userMessage, assistantMessage];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setInputValue('');
    setIsStreaming(true);

    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeRequestRef.current = requestId;
    requestMetaRef.current.set(requestId, { messageId: assistantId, startTime: Date.now() });

    // 构建发送给 API 的消息历史：
    // 1. 系统提示（含搜索结果上下文）
    // 2. 已完成的 user/assistant 消息（过滤掉还在 streaming 的，避免发送空内容）
    // 有个||是出于防御性编程的目的
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
        messages:        chatMessages,
        api_key:         settings.apiKey,
        base_url:        settings.baseUrl,
        model_name:      settings.chatModelName || settings.regexModelName,
        request_id:      requestId,
        enable_thinking: enableThinking,
        thinking_budget: thinkingBudget,
      });
    } catch {
      // 正确 finalize 那条 assistant message
      const nextMessages = messagesRef.current.map((m) => {
        if (m.id !== assistantId) return m;
        return {
          ...m,
          streaming: false,
          content: `**Error:** ${t('aiChat.startFailed')}`,
        };
      });
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      setIsStreaming(false);
      showSnackbar(t('aiChat.startFailed'), 'error');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  // ─── 渲染 ───────────────────────────────────────────────────────────────────

  /** 折叠/展开思考过程 */
  const handleToggleThink = useCallback((messageId) => {
    const nextMessages = messagesRef.current.map((m) =>
      m.id === messageId ? { ...m, thinkCollapsed: !m.thinkCollapsed } : m
    );
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }, []);

  const renderMessage = (message) => {
    // 系统信息条（如"已挂载上下文"）
    if (message.role === 'info') {
      return (
        <Box key={message.id} sx={{ pb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t(message.content)}
          </Typography>
        </Box>
      );
    }

    const isUser     = message.role === 'user';
    const header     = isUser ? t('aiChat.user') : (message.modelName || 'AI');
    const mergedThink = `${message.reasoningRaw || ''}${message.thinkContent || ''}`.trim();

    return (
      <Box
        key={message.id}
        sx={{
          mb: 2.5,
          pl: 1.5,
          py: 1,   // ← 加这一行
          borderLeft: isUser
            ? `4px solid ${alpha(theme.palette.primary.main, 0.5)}`
            : `4px solid transparent`,   // 占位，防止内容左移抖动
          bgcolor: isUser
            ? alpha(theme.palette.primary.main, 0.04)
            : 'transparent',
          borderRadius: '0 4px 4px 0',
        }}
      >
        {/* 消息头：角色名 + 时间戳 */}
        <Box sx={{ mb: 0.5 }}>
          <Typography
            variant="subtitle2"
            component="span"
            sx={{ fontWeight: 600, mr: 1 }}
          >
            {header}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {message.createdAt}
          </Typography>
        </Box>

        {/* 思考过程（仅 AI 消息且有内容时显示）*/}
        {!isUser && (
          <ThinkBlock
            thinkText={mergedThink}
            collapsed={message.thinkCollapsed}
            onToggle={() => handleToggleThink(message.id)}
          />
        )}

        {/* 正文内容 */}
        <Box sx={{ overflowX: 'hidden', '& pre': { overflowX: 'auto' } }}>
          <MarkdownContent content={message.content} styles={markdownStyles} />
        </Box>

        {/* Token 用量指标 */}
        {!isUser && <MessageMetrics metrics={message.metrics} />}
      </Box>
    );
  };

  // ─── JSX ────────────────────────────────────────────────────────────────────

  const canSend = !!inputValue.trim() && !isStreaming;

  return (
    <>  {/* React Fragment 不能删 */}
    <Dialog
      open={open && !minimized}
      onClose={(event, reason) => {
        if (reason === 'backdropClick') {
          onMinimizedChange(true);
        } else {
          onClose();
        }
      }}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          {/* 标题部分 */}
          <Typography variant="h6" component="h1" fontWeight="700" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToy sx={{ color: 'primary.main' }} />
            {t('aiChat.title')}
          </Typography>
          {/* 按钮区 */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={t('aiChat.minimize')}>
              <IconButton onClick={() => onMinimizedChange(true)}>
                <Remove />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('aiChat.close')}>
              <IconButton onClick={onClose}>
                <Close />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ height: '70vh', p: 0 }}>
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 消息列表 */}
          <Box
            ref={scrollRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              px: 2.5,
              py: 2,
            }}
          >
            {messages.map(renderMessage)}
          </Box>

          {/* 输入区 */}
          <Box
            sx={{
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              px: 2,
              py: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                multiline
                minRows={enableThinking && !isStreaming ? 5 : 3}
                maxRows={8}
                placeholder={t('aiChat.placeholder')}
                fullWidth
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                size="small"
              />

              {/* 右侧按钮列：思考按钮（含预算）+ 发送按钮 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, mb: 0.25 }}>

                {/* 思考按钮 + 预算输入（开启时显示） */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip
                    title={enableThinking ? t('aiChat.thinkingOff') : t('aiChat.thinkingOn')}
                    placement="left"
                    arrow
                  >
                    <span>     {/* 解决红字报错：某个 <Tooltip> 包裹了一个 disabled 的按钮，disabled 元素不触发鼠标事件，Tooltip 监听不到所以无法显示。 */}
                    <IconButton
                      size="small"
                      disabled={isStreaming}
                      onClick={() => setEnableThinking(v => !v)}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: enableThinking
                          ? alpha(theme.palette.primary.main, 0.12)
                          : 'transparent',
                        color: enableThinking ? 'primary.main' : 'text.secondary',
                        border: '1px solid',
                        borderColor: enableThinking
                          ? theme.palette.primary.main
                          : alpha(theme.palette.text.primary, 0.23),
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          bgcolor: enableThinking
                            ? alpha(theme.palette.primary.main, 0.2)
                            : alpha(theme.palette.action.hover, 0.08),
                        },
                        '&.Mui-disabled': {
                          borderColor: alpha(theme.palette.text.primary, 0.12),
                          color: 'action.disabled',
                        },
                      }}
                    >
                      <Lightbulb sx={{ fontSize: 18 }} />
                    </IconButton>
                    </span>
                  </Tooltip>

                  {/* 预算输入：仅开启时显示 */}
                  {enableThinking && !isStreaming && (
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: 40,
                      border: '1px solid',
                      borderColor: alpha(theme.palette.text.primary, 0.23),
                      borderRadius: 1.5,
                      overflow: 'hidden',
                    }}>
                      <IconButton
                        size="small"
                        disabled={isStreaming}
                        onClick={() => setThinkingBudget(v => v >= 32768 ? 128 : v * 2)}
                        sx={{ width: '100%', height: 10, borderRadius: 0, py: 0 }}
                      >
                        <ExpandLess sx={{ fontSize: 14 }} />
                      </IconButton>
                      <Typography
                        variant="caption"
                        sx={{ fontSize: '0.62rem', lineHeight: 1, py: 0.5, userSelect: 'none', color: isStreaming ? 'text.disabled' : 'text.secondary' }}
                      >
                        {thinkingBudget}
                      </Typography>
                      <IconButton
                        size="small"
                        disabled={isStreaming}
                        onClick={() => setThinkingBudget(v => v <= 128 ? 32768 : v / 2)}
                        sx={{ width: '100%', height: 10, borderRadius: 0, py: 0 }}
                      >
                        <ExpandMore sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  )}
                </Box>

                {/* 发送按钮 */}
                <IconButton
                  onClick={handleSend}
                  disabled={!canSend}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: canSend ? 'primary.main' : alpha(theme.palette.action.disabled, 0.08),
                    color: canSend ? 'primary.contrastText' : 'action.disabled',
                    transition: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out',
                    '&:hover': { bgcolor: canSend ? 'primary.dark' : undefined },
                    '&.Mui-disabled': {
                      bgcolor: alpha(theme.palette.action.disabled, 0.08),
                      color: 'action.disabled',
                    },
                  }}
                >
                  {isStreaming
                    ? <CircularProgress size={18} color="inherit" />
                    : <Send sx={{ fontSize: 20 }} />
                  }
                </IconButton>

              </Box>
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>

    {/* 最小化时的悬浮按钮 */}
    {open && minimized && (
      <Tooltip title={t('aiChat.restore')} placement="left">
        <Fab
          color="secondary"
          size="medium"
          onClick={() => onMinimizedChange(false)}
          sx={{
            position: 'fixed',
            bottom: !isAtBottom ? 24 : 'calc(100vh - 156px)',
            right: 18,
            zIndex: 1301,
            transition: 'bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <SmartToy />
        </Fab>
      </Tooltip>
    )}
    </>
  );
};

export default AIChatDialog;
