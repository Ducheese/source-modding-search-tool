import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  TextField,
  alpha,
  useTheme,
} from '@mui/material';
import { Close, ExpandLess, ExpandMore, Send } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSnackbar } from '../App';
import { loadAiSettings } from '../utils/aiDefaults';
import { formatResultsForExport } from '../utils/searchEngine';
import { tauriAPI } from '../utils/tauriBridge';
import { listen } from '@tauri-apps/api/event';

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
        <Typography variant="caption">思考过程</Typography>
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
  if (!metrics) return null;
  const { promptTokens, cachedTokens, completionTokens, tokenSpeed, duration } = metrics;
  return (
    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
      {`输入 ${promptTokens}${cachedTokens ? ` (缓存 ${cachedTokens})` : ''} tok`
      + ` | 输出 ${completionTokens} tok`
      + ` | ${tokenSpeed.toFixed(1)} tok/s`
      + ` | ${duration.toFixed(1)}s`}
    </Typography>
  );
});

// ─── 主组件 ──────────────────────────────────────────────────────────────────

const AIChatDialog = ({ open, onClose, results }) => {
  const theme       = useTheme();
  const showSnackbar = useSnackbar();

  // ── State ──
  const [messages,   setMessages]   = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // ── Refs（用于事件回调中访问最新值，避免 stale closure）──
  const messagesRef       = useRef([]);   // 消息列表的 source of truth
  const scrollRef         = useRef(null); // 消息列表的 DOM 节点
  const throttleTimerRef  = useRef(null); // 节流计时器（非防抖！）
  const activeRequestRef  = useRef(null); // 当前进行中的 requestId
  const requestMetaRef    = useRef(new Map()); // requestId → { messageId, startTime }
  const contextPromptRef  = useRef('');   // 搜索结果上下文文本（稳定引用）

  // ── Memo ──
  // markdownStyles 依赖 theme，只在 theme 切换时重建，不随每次渲染重建
  const markdownStyles = useMemo(() => ({
    fontFamily: '"Roboto", "Helvetica", "Arial", "Noto Sans SC", sans-serif',
    lineHeight: 1.75,
    color: theme.palette.text.primary,
    maxWidth: '100%',
    wordBreak: 'break-word',
    '& p': { margin: '0.5rem 0 1rem 0' },
    // 标题：每级明确区分字号（参考 Typora 默认主题比例）
    '& h1': { fontSize: '1.8em', fontWeight: 700, margin: '1.5rem 0 0.8rem', lineHeight: 1.3 },
    '& h2': { fontSize: '1.4em', fontWeight: 600, margin: '1.4rem 0 0.7rem', lineHeight: 1.3 },
    '& h3': { fontSize: '1.15em', fontWeight: 600, margin: '1.2rem 0 0.6rem', lineHeight: 1.3 },
    '& h4': { fontSize: '1em', fontWeight: 600, fontStyle: 'italic', margin: '1rem 0 0.5rem' },
    '& ul, & ol': { paddingLeft: '1.5rem', margin: '0 0 1rem 0' },
    '& li': { marginBottom: '0.35rem' },
    // 链接
    '& a': {
      color: theme.palette.primary.main,
      textDecoration: 'none',
      '&:hover': { textDecoration: 'underline' },
    },
    // 图片
    '& img': { maxWidth: '100%', height: 'auto', borderRadius: '4px' },
    // 分割线
    '& hr': {
      border: 'none',
      borderTop: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
      margin: '1.5rem 0',
    },
    // 表格
    '& table': {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: '1rem',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: `0 0 0 1px ${alpha(theme.palette.divider, 0.25)}`,
    },
    '& th, & td': {
      border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
      padding: '9px 14px',
      textAlign: 'left',
      fontSize: '0.9rem',
    },
    '& th': {
      backgroundColor: alpha(theme.palette.text.primary, 0.04),
      fontWeight: 600,
      whiteSpace: 'nowrap',   // ← 加这一行，标题行永不换行
    },
    // 行内代码
    '& code': {
      fontFamily: '"JetBrains Mono", "Noto Sans SC", monospace',
      fontSize: '0.85em',
      color: theme.palette.mode === 'dark' ? '#ff7b72' : '#d73a49',
      backgroundColor: alpha(theme.palette.text.primary, 0.06),
      padding: '0.15em 0.4em',
      borderRadius: '4px',
      fontWeight: 400,   // ← 加这一行，代码不会被加粗
    },
    // 代码块
    '& pre': {
      backgroundColor: theme.palette.mode === 'dark' ? '#161b22' : '#f6f8fa',
      padding: '14px 16px',
      borderRadius: '8px',
      overflowX: 'auto',
      margin: '0 0 1rem 0',
      '& code': { color: 'inherit', backgroundColor: 'transparent', padding: 0 },
    },
    // 引用块（挺好的，对味了）
    '& blockquote': {
      margin: '0 0 1rem 0',
      padding: '0.3rem 0 0.3rem 1rem',
      borderLeft: `3px solid ${alpha(theme.palette.text.secondary, 0.3)}`,
      // 不设 backgroundColor
      color: theme.palette.text.secondary,
      borderRadius: 0,
      fontStyle: 'italic',  // 斜体是 blockquote 的经典语义表达
      '& p': { margin: 0 },
      '& code': { fontStyle: 'normal' },  // 代码不斜体
    },
  }), [theme]);

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
    const contextNotice = {
      id: `context-${Date.now()}`,
      role: 'info',
      content: '已挂载搜索结果上下文',
      createdAt: formatTimestamp(new Date()),
    };
    messagesRef.current = [contextNotice];
    setMessages([contextNotice]);
    setInputValue('');
    setIsStreaming(false);
    activeRequestRef.current = null;
    requestMetaRef.current.clear();

    try {
      contextPromptRef.current = formatResultsForExport(results, 'txt');
    } catch {
      contextPromptRef.current = '搜索结果为空或无法导出。';
    }
  }, [results]);

  // ─── Effects ───────────────────────────────────────────────────────────────

  // 打开/关闭对话框时的副作用
  useEffect(() => {
    if (open) {
      resetDialogState();
    } else {
      activeRequestRef.current = null;
      setIsStreaming(false);
    }
  }, [open, resetDialogState]);

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
        showSnackbar(payload.error, 'error');
        setIsStreaming(false);
        cancelPendingUpdate();
        return;
      }

      // 流式内容 delta
      if (payload.delta) {
        const { content, reasoning_content } = payload.delta;
        if (!content && !reasoning_content) return;

        const nextMessages = messagesRef.current.map((m) => {
          if (m.id !== meta.messageId) return m;
          let updated = m;
          if (content)           updated = parseThinkChunk(updated, content);
          if (reasoning_content) updated = { ...updated, reasoningRaw: (updated.reasoningRaw || '') + reasoning_content };
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

    const settings = loadAiSettings();
    if (!settings.baseUrl || !settings.apiKey || !settings.modelName) {
      showSnackbar('请进入「关于与帮助」填写「大模型接入配置」', 'warning');
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
      modelName:     settings.modelName,
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
    const chatMessages = [
      { role: 'system', content: `以下是搜索结果上下文：\n\n${contextPromptRef.current}` },
      ...nextMessages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.streaming)
        .map((m) => ({ role: m.role, content: m.content || '' })),
    ];

    try {
      await tauriAPI.streamAiChat({
        messages:    chatMessages,
        api_key:     settings.apiKey,
        base_url:    settings.baseUrl,
        model_name:  settings.modelName,
        request_id:  requestId,
      });
    } catch {
      showSnackbar('AI 请求启动失败', 'error');
      setIsStreaming(false);
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
            {message.content}
          </Typography>
        </Box>
      );
    }

    const isUser     = message.role === 'user';
    const header     = isUser ? '用户' : (message.modelName || 'AI');
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          {/* 标题部分 */}
          <Typography variant="h6" component="h1" fontWeight="700">
            发给 AI 分析
          </Typography>
          {/* 关闭按钮部分 */}
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
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
                minRows={2}
                maxRows={6}
                placeholder="输入你的问题 · Enter 发送 · Shift+Enter 换行"
                fullWidth
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                size="small"
              />
              {/* 发送按钮：有图标 + 流式时显示 loading */}
              <IconButton
                onClick={handleSend}
                disabled={!canSend}
                sx={{
                  alignSelf: 'flex-end',
                  mb: 0.25,
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
      </DialogContent>
    </Dialog>
  );
};

export default AIChatDialog;
