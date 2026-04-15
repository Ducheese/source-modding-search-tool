import React, { useState, useEffect, useRef, useMemo, useCallback, useTransition } from 'react';
import { Box, Typography, Chip, Button, Menu, MenuItem, useTheme, alpha, CircularProgress, Alert } from '@mui/material';
import { Download, SmartToy, UnfoldMore, UnfoldLess } from '@mui/icons-material';
import { exportResults } from '../utils/searchEngine';
import AIChatDialog from './AIChatDialog';
import VirtualizedResults from './VirtualizedResults';
import { useLanguage } from '../contexts/LanguageContext';
import { useSnackbar } from '../contexts/SnackbarContext';

// 抽离的展开/收起图标动画组件
const AnimatedExpandIcon = ({ isAllExpanded }) => (
  <Box
    sx={{
      position: 'relative',
      width: 24,
      height: 24,
      flexShrink: 0,
      lineHeight: 0,
      transformOrigin: 'center',
      transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
      transform: isAllExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
      '& .icon-layer': {
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        transition: 'opacity 180ms ease',
      },
      '& .MuiSvgIcon-root': {
        fontSize: 22,
        display: 'block',
      },
    }}
  >
    <Box className="icon-layer" sx={{ opacity: isAllExpanded ? 0 : 1 }}>
      <UnfoldMore aria-hidden="true" />
    </Box>
    <Box className="icon-layer" sx={{ opacity: isAllExpanded ? 1 : 0 }}>
      <UnfoldLess aria-hidden="true" />
    </Box>
  </Box>
);

const SearchResults = ({ results, isSearching, isAtBottom }) => {
  const theme = useTheme();
  const { t } = useLanguage();
  const [anchorEl, setAnchorEl] = useState(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiMinimized, setAiMinimized] = useState(false);
  const [chatResults, setChatResults] = useState(null); // 对话绑定的结果快照

  // 展开状态：唯一 source of truth
  const [expandedFiles, setExpandedFiles] = useState(() => new Set());
  const [isExpandPending, startExpandTransition] = useTransition();

  // VirtualizedResults 的 ref，用于在 setState 前预清缓存
  const virtualizedRef = useRef(null);

  // 从 expandedFiles 派生三态：'none' | 'some' | 'all'
  const filePaths = useMemo(() => results?.files?.map(f => f.path) ?? [], [results]);
  const expandedCount = useMemo(() => {
    let count = 0;
    for (const path of filePaths) {
      if (expandedFiles.has(path)) count++;
    }
    return count;
  }, [filePaths, expandedFiles]);
  const expandState = expandedCount === 0 ? 'none' : expandedCount === filePaths.length ? 'all' : 'some';

  // 切换单个文件展开状态
  const toggleFile = useCallback((path) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // 展开/折叠全部
  const expandAll = useCallback(() => {
    if (expandState === 'all') return;
    virtualizedRef.current?.invalidateFrom(0);
    startExpandTransition(() => {
      setExpandedFiles(new Set(filePaths));
    });
  }, [expandState, filePaths]);

  const collapseAll = useCallback(() => {
    if (expandState === 'none') return;
    virtualizedRef.current?.invalidateFrom(0);
    setExpandedFiles(new Set());
  }, [expandState]);

  const handleToggleExpandAll = useCallback(() => {
    if (expandState === 'all') collapseAll();
    else expandAll();
  }, [expandState, collapseAll, expandAll]);

  // 搜索时显示的文本（在搜索开始时固定，避免闪烁）
  const searchingTextRef = useRef(0);
  const prevIsSearchingRef = useRef(false);

  useEffect(() => {
    // 只在 isSearching 从 false 变为 true 时固定随机值
    if (isSearching && !prevIsSearchingRef.current) {
      searchingTextRef.current = Math.random() < 0.5 ? 0 : 1;
    }
    prevIsSearchingRef.current = isSearching;
  }, [isSearching]);

  // 解决红字报错：isSearching 或 results 变化时关掉 Menu
  useEffect(() => {
    setAnchorEl(null);
  }, [isSearching, results]);

  // 搜索开始时清空展开状态（比 results 变化时更早，避免一帧闪烁）
  useEffect(() => {
    if (isSearching) {
      setExpandedFiles(new Set());
    }
  }, [isSearching]);

  const handleExportClick = (event) => setAnchorEl(event.currentTarget);
  const handleExportClose = () => setAnchorEl(null);
  const handleExport = (format) => {
    try {
      exportResults(results, format, t);
    } catch (error) {
      console.error('Export failed:', error);
    }
    handleExportClose();
  };

  const handleOpenChat = () => {
    if (!aiChatOpen) {
      // 对话已关闭（叉掉）→ 用当前结果重新初始化
      setChatResults(results);
      setAiChatOpen(true);
      setAiMinimized(false);
    } else if (aiMinimized) {
      if (results !== chatResults) {
        // 全新搜索结果 → 关掉再开，触发 AIChatDialog 重新初始化
        setAiChatOpen(false);
        setChatResults(results);
        setTimeout(() => { setAiChatOpen(true); setAiMinimized(false); }, 0);
      } else {
        // 同一结果 → 仅取消收纳
        setAiMinimized(false);
      }
    }
  };

  // 主内容区：根据状态决定渲染什么
  let mainContent;

  if (isSearching) {
    mainContent = (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: theme.palette.text.secondary }}>
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="h6">
          {searchingTextRef.current === 0 ? t('results.searching1') : t('results.searching2')}
        </Typography>
      </Box>
    );
  } else if (!results) {
    mainContent = (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: theme.palette.text.secondary }}>
        <Typography variant="h6">{t('results.emptyTitle')}</Typography>
        <Typography variant="body2">{t('results.emptyHint')}</Typography>
      </Box>
    );
  } else if (results.error) {
    mainContent = (
      <Alert severity="error" sx={{ m: 2 }}>
        {results.error}
      </Alert>
    );
  } else if (results.files.length === 0) {
    mainContent = (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: theme.palette.text.secondary }}>
        <Typography variant="h6">{t('results.noMatchTitle')}</Typography>
        <Typography variant="body2">{t('results.noMatchHint', { count: results.totalFiles })}</Typography>
      </Box>
    );
  } else {
    mainContent = (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>

          {/* 第一行：标题与全局操作 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h6" fontWeight="700" sx={{ lineHeight: 1.2 }}>
              {t('results.title')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="contained" startIcon={<SmartToy />} onClick={handleOpenChat}>
                {t('results.sendToAi')}
              </Button>
              <Button size="small" variant="outlined" startIcon={<Download />} onClick={handleExportClick}>
                {t('results.export')}
              </Button>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleExportClose}>
                <MenuItem onClick={() => handleExport('txt')}>TXT</MenuItem>
                <MenuItem onClick={() => handleExport('md')}>Markdown</MenuItem>
              </Menu>
            </Box>
          </Box>

          {/* 第二行：统计数据与列表视图控制 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            {/* 左侧：统计 Chips */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={
                  results.inputFiles > results.totalFiles
                    ? `${t('results.totalFiles', { count: results.totalFiles })} (-${results.inputFiles - results.totalFiles})`
                    : t('results.totalFiles', { count: results.totalFiles })
                }
              />
              <Chip size="small" label={t('results.matchedFiles', { count: results.matchedFiles })} color="secondary" />
              <Chip size="small" label={t('results.totalMatches', { count: results.totalMatches })} color="primary" />
              <Chip size="small" label={t('results.executionTime', { ms: results.executionTime })} />
            </Box>

            {/* 右侧：展开/收起 控制器 */}
            <Button
              size="small"
              variant="text"
              onClick={handleToggleExpandAll}
              disabled={isExpandPending && expandState !== 'all'}
              disableRipple
              startIcon={<AnimatedExpandIcon isAllExpanded={expandState === 'all'} />}
              sx={{
                minWidth: 0,
                px: 1,
                py: 0.5,
                whiteSpace: 'nowrap',
                color: expandState === 'none'
                  ? theme.palette.text.secondary
                  : theme.palette.primary.main,
                '& .MuiButton-startIcon': {
                  marginLeft: 0,
                  marginRight: 0.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                '&:hover': {
                  bgcolor: 'transparent',
                  color: theme.palette.primary.dark,
                },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                {expandState === 'all' ? t('results.collapseAll') : t('results.expandAll')}
              </Box>
              {expandState === 'some' && (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ ml: 0.5, fontWeight: 700 }}
                >
                  ({expandedCount}/{filePaths.length})
                </Typography>
              )}
            </Button>
          </Box>

        </Box>
        <VirtualizedResults ref={virtualizedRef} results={results} expandedFiles={expandedFiles} onToggleFile={toggleFile} />
      </Box>
    );
  }

  // AIChatDialog 始终渲染，不随 loading/空态/错误被卸载，对话历史得以保留
  return (
    <>
      {mainContent}
      <AIChatDialog
        open={aiChatOpen}
        onClose={() => { setAiChatOpen(false); setAiMinimized(false); }}
        results={chatResults}
        minimized={aiMinimized}
        onMinimizedChange={setAiMinimized}
        isAtBottom={isAtBottom}
      />
    </>
  );
};

export default SearchResults;
