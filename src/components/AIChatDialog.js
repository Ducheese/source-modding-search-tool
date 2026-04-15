import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useSnackbar } from '../contexts/SnackbarContext';
import { getMarkdownStyles } from '../utils/markdownStyles';
import { useLanguage } from '../contexts/LanguageContext';
import { useAiChatSession } from '../hooks/useAiChatSession';

// ─── 子组件（用 React.memo 避免已完成消息的重复渲染）────────────────────────

/**
 * Markdown 渲染单元
 */
const MarkdownContent = React.memo(({ content, styles }) => (
  <Box sx={styles}>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  </Box>
));

/**
 * 思考过程折叠块
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
 * Token 用量与速度指标行
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
  const theme = useTheme();
  const showSnackbar = useSnackbar();
  const { t, lang } = useLanguage();
  const scrollRef = useRef(null);
  const prevOpenRef = useRef(open);

  const markdownStyles = useMemo(() => getMarkdownStyles(theme), [theme]);

  // 使用 AI 对话会话 hook
  const {
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
  } = useAiChatSession({ results, lang, t, showSnackbar });

  const [inputValue, setInputValue] = useState('');

  // 打开/关闭对话框时的副作用
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (open && !wasOpen) {
      onMinimizedChange(false);
      resetSession();
    } else if (!open) {
      onMinimizedChange(false);
      finalizeStreaming();
    }
  }, [open, resetSession, onMinimizedChange, finalizeStreaming]);

  // 自动滚动
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // 发送消息
  const handleSend = async () => {
    if (isStreaming || !inputValue.trim()) return;

    const content = inputValue.trim();
    const success = await sendMessage(content, { enableThinking, thinkingBudget });
    if (success) {
      setInputValue('');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  // 渲染单条消息
  const renderMessage = (message) => {
    if (message.role === 'info') {
      return (
        <Box key={message.id} sx={{ pb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t(message.content)}
          </Typography>
        </Box>
      );
    }

    const isUser = message.role === 'user';
    const header = isUser ? t('aiChat.user') : (message.modelName || 'AI');
    const mergedThink = `${message.reasoningRaw || ''}${message.thinkContent || ''}`.trim();

    return (
      <Box
        key={message.id}
        sx={{
          mb: 2.5,
          pl: 1.5,
          py: 1,
          borderLeft: isUser
            ? `4px solid ${alpha(theme.palette.primary.main, 0.5)}`
            : `4px solid transparent`,
          bgcolor: isUser
            ? alpha(theme.palette.primary.main, 0.04)
            : 'transparent',
          borderRadius: '0 4px 4px 0',
        }}
      >
        <Box sx={{ mb: 0.5 }}>
          <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600, mr: 1 }}>
            {header}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {message.createdAt}
          </Typography>
        </Box>

        {!isUser && (
          <ThinkBlock
            thinkText={mergedThink}
            collapsed={message.thinkCollapsed}
            onToggle={() => toggleThink(message.id)}
          />
        )}

        <Box sx={{ overflowX: 'hidden', '& pre': { overflowX: 'auto' } }}>
          <MarkdownContent content={message.content} styles={markdownStyles} />
        </Box>

        {!isUser && <MessageMetrics metrics={message.metrics} />}
      </Box>
    );
  };

  const canSend = !!inputValue.trim() && !isStreaming;

  return (
    <>
    <Dialog
      open={open && !minimized}
      onClose={(event, reason) => {
        // 先移除焦点，再关闭（避免 aria-hidden 警告）
        if (document.activeElement) {
          document.activeElement.blur();
        }
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
          <Typography variant="h6" component="h1" fontWeight="700" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToy sx={{ color: 'primary.main' }} />
            {t('aiChat.title')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={t('aiChat.minimize')}>
              <IconButton onClick={() => onMinimizedChange(true)}>
                <Remove />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('aiChat.close')}>
              <IconButton onClick={() => {
                if (document.activeElement) {
                  document.activeElement.blur();
                }
                onClose();
              }}>
                <Close />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ height: '70vh', p: 0 }}>
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 消息列表 */}
          <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: 2.5, py: 2 }}>
            {messages.map(renderMessage)}
          </Box>

          {/* 输入区 */}
          <Box sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.2)}`, px: 2, py: 1.5 }}>
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

              {/* 右侧按钮列 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, mb: 0.25 }}>

                {/* 思考按钮 */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip title={enableThinking ? t('aiChat.thinkingOff') : t('aiChat.thinkingOn')} placement="left" arrow>
                    <span>
                    <IconButton
                      size="small"
                      disabled={isStreaming}
                      onClick={() => setEnableThinking(v => !v)}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: enableThinking ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                        color: enableThinking ? 'primary.main' : 'text.secondary',
                        border: '1px solid',
                        borderColor: enableThinking ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.23),
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          bgcolor: enableThinking ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.action.hover, 0.08),
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

                  {/* 预算输入 */}
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
                  {isStreaming ? <CircularProgress size={18} color="inherit" /> : <Send sx={{ fontSize: 20 }} />}
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
