import React, { useState } from 'react';
import { Box, Typography, Chip, Button, Menu, MenuItem, useTheme, alpha, CircularProgress, Alert } from '@mui/material';
import { Download } from '@mui/icons-material';
import { exportResults } from '../utils/searchEngine';
import VirtualizedResults from './VirtualizedResults';   // 这是现在唯一的神
import { useSnackbar } from '../App';

const SearchResults = ({ results, isSearching }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);

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

  // Loading 态
  if (isSearching) {
    return (
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
  }

  // 空态
  if (!results) {
    return (
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
  }

  // 错误态
  if (results.error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        搜索出错: {results.error}
      </Alert>
    );
  }

  // 无结果
  if (results.files.length === 0) {
    return (
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
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 头部统计栏 (保持精美) */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" fontWeight="bold">搜索结果</Typography>
          <Box>
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
};

export default SearchResults;