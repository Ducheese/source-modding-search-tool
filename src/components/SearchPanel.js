import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Chip,
  Autocomplete,
  Typography,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  Stop,
  History,
} from '@mui/icons-material';
import { searchInFiles } from '../utils/searchEngine';

const SearchPanel = ({ files, onSearch, onSearchStart, isSearching }) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const searchInputRef = useRef(null);

  // 从 localStorage 加载搜索历史
  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Failed to load search history:', error);
      }
    }
  }, []);

  // 保存搜索历史到 localStorage
  const saveSearchHistory = (query) => {
    if (!query.trim()) return;
    
    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || files.length === 0) return;

    saveSearchHistory(searchQuery);
    setHistoryOpen(false);
    onSearchStart();

    try {
      const searchOptions = {
        query: searchQuery,
        caseSensitive,
        wholeWord,
        useRegex,
      };

      const results = await searchInFiles(files, searchOptions);
      onSearch(results);
    } catch (error) {
      console.error('Search failed:', error);
      onSearch({ error: error.message });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const stopSearch = () => {
    // 这里可以添加停止搜索的逻辑
    onSearch(null);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom fontWeight="bold">
        搜索配置
      </Typography>

      {/* 搜索输入框 */}
      <Box sx={{ mb: 2 }}>
        <Autocomplete
          freeSolo
          options={searchHistory}
          onOpen={() => setHistoryOpen(true)}
          onClose={() => setHistoryOpen(false)}
          inputValue={searchQuery}
          onInputChange={(e, value) => setSearchQuery(value)}
          componentsProps={{
            paper: {
              sx: {
                // 当前组件是 Autocomplete 的 Paper 容器 (MuiPaper-root)
                '& ul': {
                  '&::-webkit-scrollbar': {
                    width: '6px',
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
                },
              },
            },
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={searchInputRef}
              placeholder="输入搜索内容..."
              variant="outlined"
              size="small"
              onKeyPress={handleKeyPress}
              disabled={isSearching}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <Search sx={{ color: 'text.secondary', mr: 1 }} />
                    {params.InputProps.startAdornment}
                  </>
                ),
                endAdornment: (
                  <>
                    {isSearching && (
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                    )}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <History sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2">{option}</Typography>
            </Box>
          )}
        />
      </Box>

      {/* 搜索选项 */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              disabled={isSearching}
            />
          }
          label="区分大小写"
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
              disabled={isSearching}
            />
          }
          label="全词匹配"
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={useRegex}
              onChange={(e) => setUseRegex(e.target.checked)}
              disabled={isSearching}
            />
          }
          label="正则表达式"
        />
      </Box>

      {/* 搜索选项标签 */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {caseSensitive && (
          <Chip size="small" label="Aa" color="primary" variant="outlined" />
        )}
        {wholeWord && (
          <Chip size="small" label="全词" color="primary" variant="outlined" />
        )}
        {useRegex && (
          <Chip size="small" label="正则" color="primary" variant="outlined" />
        )}
      </Box>

      {/* 搜索按钮 */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        {!isSearching ? (
          <Button
            variant="contained"
            startIcon={<Search />}
            onClick={handleSearch}
            disabled={!searchQuery.trim() || files.length === 0}
            sx={{ minWidth: 120 }}
          >
            搜索
          </Button>
        ) : (
          <Button
            variant="outlined"
            color="error"
            startIcon={<Stop />}
            onClick={stopSearch}
            sx={{ minWidth: 120 }}
          >
            停止
          </Button>
        )}
        
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {files.length > 0 ? `将在 ${files.length} 个文件中搜索` : '请先添加文件'}
        </Typography>
      </Box>
    </Box>
  );
};

export default SearchPanel;