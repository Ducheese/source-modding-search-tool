import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Menu,
  MenuItem,
  useTheme,
  alpha,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Download,
  MoreVert,
  ContentCopy,
  Launch,
} from '@mui/icons-material';
import { exportResults } from '../utils/searchEngine';
import VirtualizedResults from './VirtualizedResults';

const SearchResults = ({ results, isSearching }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [expandedPanels, setExpandedPanels] = useState(new Set());

  const handleExportClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setAnchorEl(null);
  };

  const handleExport = (format) => {
    try {
      exportResults(results, format);
    } catch (error) {
      console.error('Export failed:', error);
    }
    handleExportClose();
  };

  const handlePanelChange = (panelPath) => (event, isExpanded) => {
    setExpandedPanels(prev => {
      const newSet = new Set(prev);
      if (isExpanded) {
        newSet.add(panelPath);
      } else {
        newSet.delete(panelPath);
      }
      return newSet;
    });
  };

  const copyFilePath = (path) => {
    navigator.clipboard.writeText(path);
  };

  const copyFileContent = async (path) => {
    try {
      const { content } = await window.electronAPI.readFile(path);
      navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy file content:', error);
    }
  };

  const copyLineContent = (line) => {
    // 剔除换行符和其他空白字符
    const cleanLine = line.replace(/[\r\n]+/g, '').trim();
    navigator.clipboard.writeText(cleanLine);
  };

  const openFileExternally = (path) => {
    window.electronAPI.openFileExternally(path);
  };

  // 判断是否使用虚拟化列表（当结果数量超过阈值时）
  const shouldUseVirtualization = results && results.files && (
    results.files.length > 5 || 
    results.totalMatches > 10
  );

  if (isSearching) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'text.secondary',
        }}
      >
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          正在搜索...
        </Typography>
        <Typography variant="body2">
          请稍候，正在处理文件
        </Typography>
      </Box>
    );
  }

  if (!results) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'text.secondary',
          p: 3,
        }}
      >
        <Typography variant="h6" gutterBottom>
          准备搜索
        </Typography>
        <Typography variant="body2" align="center">
          添加文件并输入搜索内容后点击搜索按钮
        </Typography>
      </Box>
    );
  }

  if (results.error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        搜索出错: {results.error}
      </Alert>
    );
  }

  if (results.files.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'text.secondary',
          p: 3,
        }}
      >
        <Typography variant="h6" gutterBottom>
          未找到匹配结果
        </Typography>
        <Typography variant="body2" align="center">
          在 {results.totalFiles} 个文件中没有找到匹配 "{results.query}" 的内容
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 统计信息 */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            搜索结果
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExportClick}
            >
              导出
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleExportClose}
            >
              <MenuItem onClick={() => handleExport('txt')}>导出为 TXT</MenuItem>
              <MenuItem onClick={() => handleExport('md')}>导出为 Markdown</MenuItem>
            </Menu>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Chip size="small" label={`总文件: ${results.totalFiles}`} />
          <Chip size="small" label={`匹配文件: ${results.matchedFiles}`} color="primary" />
          <Chip size="small" label={`总匹配: ${results.totalMatches}`} color="secondary" />
          <Chip size="small" label={`耗时: ${results.executionTime}ms`} />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {results.options.caseSensitive && (
            <Chip size="small" label="区分大小写" variant="outlined" />
          )}
          {results.options.wholeWord && (
            <Chip size="small" label="全词匹配" variant="outlined" />
          )}
          {results.options.useRegex && (
            <Chip size="small" label="正则表达式" variant="outlined" />
          )}
        </Box>
      </Box>

      {/* 结果列表 */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {shouldUseVirtualization ? (
          <VirtualizedResults results={results} />
        ) : (
          <Box sx={{ height: '100%', overflow: 'auto', p: 1 }}>
            {results.files.map((file) => (
              <Box
                key={file.path}
                sx={{
                  mb: 1,
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {file.name}
                    </Typography>
                    <Chip size="small" label={`${file.matches.length} 匹配`} color="primary" />
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => copyFilePath(file.path)}
                      title="复制路径"
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => copyFileContent(file.path)}
                      title="复制文件内容"
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => openFileExternally(file.path)}
                      title="用默认程序打开"
                    >
                      <Launch fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                {file.matches.map((match, index) => (
                  <Box
                    key={index}
                    sx={{
                      p: 2,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" color="primary" fontWeight="bold">
                        行 {match.lineNumber}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => copyLineContent(match.line)}
                        title="复制这一行"
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Box>

                    <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {match.context.before && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ opacity: 0.7 }}
                        >
                          {match.lineNumber - 1}: {match.context.before}
                        </Typography>
                      )}
                      <Typography variant="body2">
                        {match.lineNumber}: {match.line}
                      </Typography>
                      {match.context.after && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ opacity: 0.7 }}
                        >
                          {match.lineNumber + 1}: {match.context.after}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SearchResults;