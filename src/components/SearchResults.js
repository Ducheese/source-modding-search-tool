import React, { useState } from 'react';
import { Box, Typography, Chip, Button, Menu, MenuItem, useTheme, alpha, CircularProgress, Alert } from '@mui/material';
import { Download, SmartToy } from '@mui/icons-material';
import { exportResults } from '../utils/searchEngine';
import AIChatDialog from './AIChatDialog';
import VirtualizedResults from './VirtualizedResults';   // 这是现在唯一的神

const SearchResults = ({ results, isSearching }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiMinimized, setAiMinimized] = useState(false);
  const [chatResults, setChatResults] = useState(null); // 对话绑定的结果快照

  const handleExportClick = (event) => setAnchorEl(event.currentTarget);
  const handleExportClose = () => setAnchorEl(null);
  const handleExport = (format) => {
    try {
      exportResults(results, format);
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
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: theme.palette.text.secondary,
        }}
      >
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="h6">
          {
            Math.random() < 0.5
              ? '正在穿越时间的间隙...'
              : '少女折寿中...'
          }
        </Typography>
      </Box>
    );
  } else if (!results) {
    mainContent = (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: theme.palette.text.secondary,
        }}
      >
        <Typography variant="h6">无事可做</Typography>
        <Typography variant="body2">在永恒的等待中，请输入一点什么吧。</Typography>
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
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: theme.palette.text.secondary,
        }}
      >
        <Typography variant="h6">空无一物</Typography>
        <Typography variant="body2">在 {results.totalFiles} 个文件中一无所获。</Typography>
      </Box>
    );
  } else {
    mainContent = (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 头部统计栏 */}
        <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" fontWeight="700">搜索结果</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<SmartToy />}
                onClick={handleOpenChat}
              >
                发给 AI 分析
              </Button>
              <Button size="small" variant="outlined" startIcon={<Download />} onClick={handleExportClick}>导出</Button>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleExportClose}>
                <MenuItem onClick={() => handleExport('txt')}>TXT</MenuItem>
                <MenuItem onClick={() => handleExport('md')}>Markdown</MenuItem>
              </Menu>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`总文件数: ${results.totalFiles}`} />
            <Chip size="small" label={`匹配文件数: ${results.matchedFiles}`} color="secondary" />
            <Chip size="small" label={`匹配行数: ${results.totalMatches}`} color="primary" />
            <Chip size="small" label={`耗时: ${results.executionTime}ms`} />
          </Box>
        </Box>

        {/* 唯一的真神：虚拟列表 */}
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
      />
    </>
  );
};

export default SearchResults;
