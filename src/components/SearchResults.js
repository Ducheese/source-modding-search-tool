import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Chip, Button, Menu, MenuItem, useTheme, alpha, CircularProgress, Alert } from '@mui/material';
import { Download, SmartToy } from '@mui/icons-material';
import { exportResults } from '../utils/searchEngine';
import AIChatDialog from './AIChatDialog';
import VirtualizedResults from './VirtualizedResults';
import { useLanguage } from '../utils/i18n';

const SearchResults = ({ results, isSearching, isAtBottom }) => {
  const theme = useTheme();
  const { t } = useLanguage();
  const [anchorEl, setAnchorEl] = useState(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiMinimized, setAiMinimized] = useState(false);
  const [chatResults, setChatResults] = useState(null); // 对话绑定的结果快照

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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" fontWeight="700">{t('results.title')}</Typography>
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
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={t('results.totalFiles',   { count: results.totalFiles })} />
            <Chip size="small" label={t('results.matchedFiles', { count: results.matchedFiles })} color="secondary" />
            <Chip size="small" label={t('results.totalMatches', { count: results.totalMatches })} color="primary" />
            <Chip size="small" label={t('results.executionTime', { ms: results.executionTime })} />
          </Box>
        </Box>
        <VirtualizedResults results={results} />
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
