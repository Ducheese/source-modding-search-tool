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
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
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