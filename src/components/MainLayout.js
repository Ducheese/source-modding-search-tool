import React, { useState, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
} from '@mui/material';
import FileDropZone from './FileDropZone';
import FileList from './FileList';
import SearchPanel from './SearchPanel';
import SearchResults from './SearchResults';

import { HelpOutline } from '@mui/icons-material';
import HelpDialog from './HelpDialog';
import { useLanguage } from '../utils/i18n';

const MainLayout = () => {
  const theme = useTheme();
  const { t } = useLanguage();

  const [files, setFiles] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);

  const [helpOpen, setHelpOpen] = useState(false); // 控制画卷的展开

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

  const handleScroll = useCallback((e) => {
    const el = e.currentTarget;
    // 距底部 80px 以内视为"到底"
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsAtBottom(atBottom);
  }, []);

  return (
    <Box
      sx={{
        height: '100vh',   // 强制占满视口
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        overflow: 'hidden',   // 禁止最外层出现滚动条
      }}
    >
      {/* 1. 标题栏 (固定高度) */}
      <Box
        sx={{
          py: 1, px: 3,   // 更紧凑一点
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          boxShadow: 3,
          userSelect: 'none',  // 禁止选中
          zIndex: 500,         // 堆叠顺序相对值
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
          <Typography variant="h6" component="h1" fontWeight="700">
            {t('layout.title')}
          </Typography>

          <Tooltip title={t('layout.helpTooltip')}>
            <IconButton onClick={(e) => { e.currentTarget.blur(); setHelpOpen(true); }} sx={{ color: 'primary.contrastText' }}>
              <HelpOutline />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.9, mb: 1.25 }}>
          {t('layout.subtitle')}
        </Typography>
      </Box>

      {/* 2. 主内容区 (Flex 1, 占满剩余所有高度) */}
      <Box
        onScroll={handleScroll}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',   // 滚动条
          p: 2,   // 相当于给这个主内容区加一个内边距
        }}
      >
        <Grid container spacing={2} sx={{ flex: 1 }}>
          {/* 左侧面板 - 文件管理 */}
          <Grid item xs={12} md={4} sx={{ flex: 1 }}>
            <Box sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',   // 这一层要撑满，不然列表区域文字描述会偏
              gap: 2
            }}>
              {/* 上部：拖拽区 */}
              <FileDropZone onFilesAdded={handleFilesAdded} />

              {/* 下部：列表 (Flex 1 占满剩余空间) */}
              <Paper
                sx={{
                  flex: 1,   // 自动填满 DropZone 下方的所有空间
                  minHeight: '100vh',
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
          <Grid item xs={12} md={8} sx={{ flex: 1 }}>
            <Box sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',   // 这一层要撑满，不然列表区域文字描述会偏
              gap: 2
            }}>
              {/* 上部：搜索区 */}
              <SearchPanel
                files={files}
                onSearch={handleSearch}
                onSearchStart={handleSearchStart}
                isSearching={isSearching}
              />

              {/* 下部：结果 (Flex 1 占满剩余空间) */}
              <Paper
                sx={{
                  flex: 1,   // 自动填满 DropZone 下方的所有空间
                  minHeight: '100vh',
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
                  isAtBottom={isAtBottom}
                />
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Box>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Box>
  );
};

export default MainLayout;
