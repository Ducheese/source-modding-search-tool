import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  TextField,
  Button,
  useTheme,
  alpha,
  Collapse,
} from '@mui/material';
import { Close, ExpandMore, ExpandLess } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSnackbar } from '../App';
import { loadAiSettings } from '../utils/aiDefaults';
import { formatResultsForExport } from '../utils/searchEngine';
import { tauriAPI } from '../utils/tauriBridge';
import { listen } from '@tauri-apps/api/event';

// 对应main.rs里定义的window.emit("ai-chat-stream"...
const STREAM_EVENT = 'ai-chat-stream';

const formatTimestamp = (date) => {
  const pad = (v) => String(v).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
};

// 解析思考过程 检测到 <th 或 </th 这种不完整的前缀，会主动 break 等待下一个 chunk
const parseThinkChunk = (message, chunk) => {
  const openTag = '<think>';
  const closeTag = '</think>';
  const state = {
    content: message.content || '',
    thinkContent: message.thinkContent || '',
    mode: message.parseMode || 'text',
    buffer: message.parseBuffer || '',
  };

  let buffer = state.buffer + chunk;
  let index = 0;
  while (index < buffer.length) {
    const char = buffer[index];
    if (char === '<') {
      const remaining = buffer.slice(index);
      if (remaining.startsWith(openTag)) {
        state.mode = 'think';
        index += openTag.length;
        continue;
      }
      if (remaining.startsWith(closeTag)) {
        state.mode = 'text';
        index += closeTag.length;
        continue;
      }

      const isOpenPrefix = openTag.startsWith(remaining) && remaining.length < openTag.length;
      const isClosePrefix = closeTag.startsWith(remaining) && remaining.length < closeTag.length;
      if (isOpenPrefix || isClosePrefix) {
        break;
      }
    }

    if (state.mode === 'think') {
      state.thinkContent += char;
    } else {
      state.content += char;
    }
    index += 1;
  }

  state.buffer = buffer.slice(index);
  return {
    ...message,
    content: state.content,
    thinkContent: state.thinkContent,
    parseMode: state.mode,
    parseBuffer: state.buffer,
  };
};



const AIChatDialog = ({ open, onClose, results }) => {
  const theme = useTheme();
  const showSnackbar = useSnackbar();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesRef = useRef([]);
  const scrollRef = useRef(null);
  const updateTimerRef = useRef(null);
  const activeRequestRef = useRef(null);
  const requestMetaRef = useRef(new Map());
  const contextPromptRef = useRef('');

  const markdownStyles = {
    maxWidth: '100%',
    overflow: 'hidden',
    '& p': { margin: '0 0 0.6rem 0' },
    '& ul, & ol': { paddingLeft: '1.2rem', margin: '0 0 0.6rem 0' },
    '& li': { marginBottom: '0.3rem' },
    '& table': {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: '0.8rem',
      tableLayout: 'fixed',
    },
    '& th, & td': {
      border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
      padding: '6px 8px',
      textAlign: 'left',
      fontSize: '0.85rem',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
    },
    '& code': {
      fontFamily: '"JetBrains Mono", "Roboto Mono", monospace',
      fontSize: '0.85rem',
      backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.15 : 0.08),
      padding: '2px 4px',
      borderRadius: 4,
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
    },
    '& pre': {
      backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.18 : 0.08),
      padding: '10px 12px',
      borderRadius: 6,
      overflowX: 'hidden',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      maxWidth: '100%',
    },
    '& pre code': {
      backgroundColor: 'transparent',
      padding: 0,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
    },
    '& img': {
      maxWidth: '100%',
      height: 'auto',
    },
    '& blockquote': {
      borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.6)}`,
      margin: '0 0 0.6rem 0',
      paddingLeft: '0.8rem',
      color: theme.palette.text.secondary,
    },
  };

  const renderMarkdown = (content) => (
    <Box sx={markdownStyles}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 防抖计时器 60ms间隔执行setMessages
  const scheduleUpdate = useCallback(() => {
    if (updateTimerRef.current) return;
    updateTimerRef.current = setTimeout(() => {
      updateTimerRef.current = null;
      setMessages([...messagesRef.current]);
    }, 60);
  }, []);

  // 清理防抖计时器
  const clearScheduledUpdate = useCallback(() => {
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }
  }, []);

  const resetDialogState = useCallback(() => {
    // 创建只有一条“系统提示”消息的对话 即清空并初始化对话历史
    const contextNotice = {
      id: `context-${Date.now()}`,
      role: 'info',
      content: '已挂载搜索结果上下文',
      createdAt: formatTimestamp(new Date()),
    };
    messagesRef.current = [contextNotice];
    setMessages([contextNotice]);

    // 清空输入框
    setInputValue('');

    // 停止任何正在进行的流式响应
    setIsStreaming(false);
    activeRequestRef.current = null;
    requestMetaRef.current.clear();

    try {
      contextPromptRef.current = formatResultsForExport(results, 'txt');
    } catch (error) {
      contextPromptRef.current = '搜索结果为空或无法导出。';
    }
  }, [results]);

  useEffect(() => {
    if (open) {
      resetDialogState();
    } else {
      activeRequestRef.current = null;
      setIsStreaming(false);
    }
  }, [open, resetDialogState]);

  // 监听来自 Rust 后端（Tauri）的 AI 流式响应事件，并实时更新前端对话界面，实现打字机效果
  useEffect(() => {
    const unlistenPromise = listen(STREAM_EVENT, (event) => {
      const payload = event.payload;

      // 确保只处理当前正在对话的请求
      const requestId = payload?.requestId;
      if (!requestId || requestId !== activeRequestRef.current) return;

      const meta = requestMetaRef.current.get(requestId);
      if (!meta) return;

      // 如果后端出错（网络断了、API key 无效、模型崩溃），前端立刻怎么样
      if (payload.error) {
        showSnackbar(payload.error, 'error');
        setIsStreaming(false);
        clearScheduledUpdate();
        return;
      }

      // 处理流式内容
      if (payload.delta) {
        const { content, reasoning_content } = payload.delta;
        if (!content && !reasoning_content) return;
        const nextMessages = messagesRef.current.map((m) => {
          if (m.id !== meta.messageId) return m;
          let updated = m;
          if (content) {
            updated = parseThinkChunk(updated, content);
          }
          if (reasoning_content) {
            updated = {
              ...updated,
              reasoningRaw: `${updated.reasoningRaw || ''}${reasoning_content}`,
            };
          }
          return { ...updated, updatedAt: Date.now() };
        });
        messagesRef.current = nextMessages;
        scheduleUpdate();
      }
      
      // 用量统计
      if (payload.done) {
        const nextMessages = messagesRef.current.map((m) => {
          if (m.id !== meta.messageId) return m;
          const usage = payload.usage || {};
          const promptTokens = usage.prompt_tokens || 0;
          const cachedTokens = usage.prompt_tokens_details?.cached_tokens || 0;
          const completionTokens = usage.completion_tokens || 0;
          const duration = (Date.now() - meta.startTime) / 1000;
          const tokenSpeed = duration > 0 ? completionTokens / duration : 0;
          return {
            ...m,
            metrics: {
              promptTokens,
              cachedTokens,
              completionTokens,
              tokenSpeed,
              duration,
            },
            streaming: false,
            thinkCollapsed: true,
          };
        });
        messagesRef.current = nextMessages;
        setIsStreaming(false);
        clearScheduledUpdate();
        setMessages(nextMessages);
      }
    });

    return () => {
      clearScheduledUpdate();
      unlistenPromise
        .then((unlistenFn) => {
          unlistenFn();
        })
        .catch(() => {});
    };
  }, [clearScheduledUpdate, scheduleUpdate, showSnackbar]);

  // 消息自动滚动到底部 收起思考过程时也会滚到底部
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // 发送行为
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
      modelName: settings.modelName,
      streaming: true,
      thinkCollapsed: false,
    };

    const nextMessages = [...messagesRef.current, userMessage, assistantMessage];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setInputValue('');
    setIsStreaming(true);

    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeRequestRef.current = requestId;
    requestMetaRef.current.set(requestId, {
      messageId: assistantId,
      startTime: Date.now(),
    });
    
    // 发送的content内容 搜索结果上下文和对话都在这了
    const chatMessages = [
      { role: 'system', content: `以下是搜索结果上下文：\n\n${contextPromptRef.current}` },
      ...nextMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role,
          content: m.role === 'assistant' ? m.content || '' : m.content,
        })),
    ];

    try {
      await tauriAPI.streamAiChat({
        messages: chatMessages,
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model_name: settings.modelName,
        request_id: requestId,
      });
    } catch (error) {
      showSnackbar('AI 请求失败', 'error');
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (message) => {
    if (message.role === 'info') {
      return (
        <Box key={message.id} sx={{ pb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {message.content}
          </Typography>
        </Box>
      );
    }

    const isUser = message.role === 'user';
    const header = isUser ? '用户' : message.modelName || 'AI';

    // 和前面流式传输一起的改动
    const rawContent = isUser ? message.content : message.content || '';
    const mergedThink = `${message.reasoningRaw || ''}${message.thinkContent || ''}`.trim();

    return (
      <Box key={message.id} sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {header}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {message.createdAt}
        </Typography>

        {!isUser && mergedThink && (
          <Box sx={{ mb: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'pointer',
                color: 'text.secondary',
              }}
              onClick={() => {
                const nextMessages = messagesRef.current.map((m) =>
                  m.id === message.id ? { ...m, thinkCollapsed: !m.thinkCollapsed } : m
                );
                messagesRef.current = nextMessages;
                setMessages(nextMessages);
              }}  // 点击收起/展开思考过程
            >
              {message.thinkCollapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
              <Typography variant="caption">思考过程</Typography>
            </Box>
            <Collapse in={!message.thinkCollapsed} timeout="auto" unmountOnExit>
              <Box
                sx={{
                  mt: 0.5,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.text.secondary, 0.08),
                  color: 'text.secondary',
                  whiteSpace: 'pre-wrap',
                }}
              >
                <Typography variant="caption" sx={{ 
                  whiteSpace: 'pre-line', // pre-line 会合并多余换行，比 pre-wrap 更紧凑
                  lineHeight: 1.2,        // 调低行高
                  display: 'block' 
                }}>
                  {mergedThink}
                </Typography>
              </Box>
            </Collapse>
          </Box>
        )}
        
        <Box
          sx={{
            overflowX: 'hidden',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            '& pre': {
              overflowX: 'auto',
              maxWidth: '100%',
            },
            '& code': {
              wordBreak: 'break-word',
            },
          }}
        >
          {renderMarkdown(rawContent)}
        </Box>

        {!isUser && message.metrics && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.5 }}
          >
            {`${message.metrics.promptTokens || 0} tokens${message.metrics.cachedTokens ? ` (${message.metrics.cachedTokens} cached)` : ''} | ${message.metrics.completionTokens || 0} tokens | ${message.metrics.tokenSpeed.toFixed(1)} tok/s | ${message.metrics.duration.toFixed(1)}s`}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="h1" fontWeight="bold">
            发给AI分析
          </Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ height: '70vh' }}>
        <Box
          sx={{
            height: '100%',
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box
            ref={scrollRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              px: 2,
              py: 2,
            }}
          >
            {messages.map(renderMessage)}
          </Box>

          <Box
            sx={{
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              px: 2,
              py: 1.5,
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                multiline
                minRows={2}
                maxRows={6}
                placeholder="Enter输入 Enter+Shift换行"
                fullWidth
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={!inputValue.trim() || isStreaming}
                sx={{ height: 40 }}
              >
                发送
              </Button>
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AIChatDialog;
