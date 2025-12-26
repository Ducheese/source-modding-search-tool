import React, { useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import FileDropZone from './FileDropZone';
import FileList from './FileList';
import SearchPanel from './SearchPanel';
import SearchResults from './SearchResults';

const MainLayout = () => {
  const theme = useTheme();
  const [files, setFiles] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleFilesAdded = useCallback((newFiles) => {
    setFiles(prevFiles => {
      const existingPaths = new Set(prevFiles.map(f => f.path));
      const uniqueNewFiles = newFiles.filter(f => !existingPaths.has(f.path));
      return [...prevFiles, ...uniqueNewFiles];
    });
  }, []);

  const handleFileRemoved = useCallback((filePath) => {
    setFiles(prevFiles => prevFiles.filter(f => f.path !== filePath));
  }, []);

  const handleClearFiles = useCallback(() => {
    setFiles([]);
    setSearchResults(null);
  }, []);

  const handleSearch = useCallback((results) => {
    setSearchResults(results);
    setIsSearching(false);
  }, []);

  const handleSearchStart = useCallback(() => {
    setIsSearching(true);
  }, []);

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          width: '6px',   // 垂直滚动条的宽度
          height: '6px',  // 水平滚动条的高度
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 
          theme.palette.mode === 'dark'   // 滚动条滑块的颜色
          ? 'rgba(255, 255, 255, 0.2)'  // 暗色模式
          : 'rgba(0, 0, 0, 0.2)',       // 浅色模式
          borderRadius: '10px', // 滑块圆角
        },
        '&::-webkit-scrollbar-thumb:hover': {
          backgroundColor: 
          theme.palette.mode === 'dark'   // 鼠标悬停时颜色加深
          ? 'rgba(255, 255, 255, 0.3)'  // 暗色模式
          : 'rgba(0, 0, 0, 0.3)',       // 浅色模式
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'transparent', // 滚动条轨道的颜色（通常设为透明）
        },
      }}
    >
      {/* 标题栏 */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          boxShadow: 2,
        }}
      >
        <Typography variant="h5" component="h1" fontWeight="bold">
          Source Modding Search Tool
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          为 Valve Source 1 引擎 Mod 开发者提供的高性能本地文本检索工具
        </Typography>
      </Box>

      {/* 主内容区 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        <Grid container spacing={2} sx={{ flex: 1 }}>
          {/* 左侧面板 - 文件管理 */}
          <Grid item xs={12} md={4}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* 文件拖拽区域 */}
              <FileDropZone onFilesAdded={handleFilesAdded} />
              
              {/* 文件列表 */}
              <Paper
                sx={{
                  // flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: 'calc(100vh - 344px)',
                  maxHeight: 'calc(100vh)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
                elevation={2}
              >
                <FileList
                  files={files}
                  onFileRemoved={handleFileRemoved}
                  onClearFiles={handleClearFiles}
                />
              </Paper>
            </Box>
          </Grid>

          {/* 右侧面板 - 搜索和结果 */}
          <Grid item xs={12} md={8}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* 搜索面板 */}
              <SearchPanel
                files={files}
                onSearch={handleSearch}
                onSearchStart={handleSearchStart}
                isSearching={isSearching}
              />
              
              {/* 搜索结果 */}
              <Paper
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: 'calc(100vh - 344px - 24px)',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
                elevation={2}
              >
                <SearchResults
                  results={searchResults}
                  isSearching={isSearching}
                />
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default MainLayout;