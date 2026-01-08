import React, {
  useState,
  useRef,
  useEffect,
  useReducer,
} from 'react';
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
  Grid,
  Tooltip,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  Search,
  Stop,
  History,
  FilterAlt,
  FilterList,
  Code,
  Add,
} from '@mui/icons-material';
import { searchInFiles } from '../utils/searchEngine';

// 正则快捷片段
const REGEX_SNIPPETS = [
  { label: '数字', value: '\\d+' },
  { label: '单词', value: '\\w+' },
  { label: '行首', value: '^' },
  { label: '行尾', value: '$' },
  { label: '空白', value: '\\s+' },
  { label: '中文', value: '[\\u4e00-\\u9fa5]+' },
  { label: '非贪婪', value: '.*?' },
];

// 使用 useReducer 整合所有状态配置
const initialState = {
  searchQuery: '',
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
  includePattern: '',
  excludePattern: '',
};

function searchReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_REGEX_SNIPPET':
      return { ...state, searchQuery: state.searchQuery + action.value, useRegex: true };
    default:
      return state;
  }
}

const SearchPanel = ({ files, onSearch, onSearchStart, isSearching }) => {

  const theme = useTheme();

  // 使用 useReducer 统一管理搜索配置（initialState），避免了大量 useState 的堆砌
  const [state, dispatch] = useReducer(searchReducer, initialState);
  const { searchQuery, caseSensitive, wholeWord, useRegex, includePattern, excludePattern } = state;

  const [searchHistory, setSearchHistory] = useState([]);

  // 新增：控制高级选项展开的状态
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 用于输入正则快捷方式
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

    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 30);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const handleSearch = async () => {
    // 【注意】这里不再需要前端计算 finalFilePaths 了！
    // 因为 searchInFiles 后端会自己做完全一致的过滤
    if (!searchQuery.trim() || files.length === 0) return;

    saveSearchHistory(searchQuery);
    onSearchStart();

    try {
      const searchOptions = {
        query: searchQuery,
        caseSensitive,
        wholeWord,
        useRegex,
        includePattern,
        excludePattern,
      };

      // 直接把完整的文件列表扔给后端，让它自己去筛选！
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
    onSearch(null); // 伪停止/清空状态
  };

  const insertRegexSnippet = (snippet) => {
    dispatch({ type: 'SET_REGEX_SNIPPET', value: snippet });
    searchInputRef.current?.focus();
  };

  // 通用字段更新处理器
  const handleFieldChange = (field, value) => {
    dispatch({ type: 'SET_FIELD', field, value });
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* 弹簧, 将按钮推到底部，把父容器里剩下的所有空白空间都占了 */}
      <Box sx={{ flex: 1 }} />

      <Typography variant="h6" gutterBottom fontWeight="bold">
        搜索配置
      </Typography>

      {/* --- 核心搜索区 --- */}
      {/* 2. 【敕令】将“印章”移至框外，与主体并立 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Autocomplete
          sx={{ flex: 1 }} // 让 Autocomplete 占据大部分空间
          freeSolo
          options={searchHistory}
          inputValue={searchQuery}
          onInputChange={(e, value) => handleFieldChange('searchQuery', value)}
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
                    {isSearching && <CircularProgress size={20} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => {
            // 1. 从 props 中把 key 解构出来，剩余的属性放入 otherProps
            const { key, ...otherProps } = props;
            
            return (
              <Box 
                component="li" 
                key={key}           // 2. 显式传递 key
                {...otherProps}     // 3. 展开剩余属性
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <History sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">{option}</Typography>
              </Box>
            );
          }}
        />
        {/* “印章”在此处，与搜索框并列，不再受其内部干扰 */}
        <Tooltip title="高级过滤选项">
          <IconButton
            onClick={() => setShowAdvanced(!showAdvanced)}
            color={showAdvanced ? 'primary' : 'default'}
          >
            <FilterAlt />
          </IconButton>
        </Tooltip>
      </Box>

      {/* --- 高级选项，由搜索框内的按钮控制 --- */}
      <Collapse
        in={showAdvanced}
        timeout={0}
        unmountOnExit
      >
        <Grid container spacing={2} sx={{ pt: 1 }}> {/* 加上一点上边距 */}
          {/* 左侧：文件过滤器 */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FilterList fontSize="small" /> 文件过滤
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField
                label="包含 (如: *.qc, **/weapon_*)"
                variant="outlined"
                size="small"
                fullWidth
                value={includePattern}
                onChange={(e) => handleFieldChange('includePattern', e.target.value)}
                helperText="逗号分隔，留空则包含所有"
              />
              <TextField
                label="排除 (如: *metal*, **/cfg/*)"
                variant="outlined"
                size="small"
                fullWidth
                value={excludePattern}
                onChange={(e) => handleFieldChange('excludePattern', e.target.value)}
                helperText="逗号分隔，注意“排除”优先于“包含”"
              />
            </Box>
          </Grid>

          {/* 右侧：正则辅助 (仅在开启正则时高亮，否则淡化) */}
          <Grid item xs={12} md={6}>
            <Box sx={{ opacity: useRegex ? 1 : 0.6, transition: 'opacity 0.2s' }}>
              <Typography variant="subtitle2" gutterBottom color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Code fontSize="small" /> 正则咒语
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {REGEX_SNIPPETS.map((snippet) => (
                  <Tooltip key={snippet.value} title={`插入 ${snippet.value}`}>
                    <Chip
                      label={snippet.label}
                      size="small"
                      icon={<Add sx={{ fontSize: '14px !important' }} />}
                      onClick={() => insertRegexSnippet(snippet.value)}
                      clickable={useRegex}
                      color={useRegex ? "primary" : "default"}
                      variant="outlined"
                      sx={{
                        cursor: useRegex ? 'pointer' : 'not-allowed',
                        // 【敕令】当关闭时，让它变得灰暗，而不是改变形态
                        ...(!useRegex && {
                          borderColor: theme.palette.action.disabled,
                          color: theme.palette.action.disabled,
                          '& .MuiChip-icon': { // 它的图标也一并灰暗
                            color: theme.palette.action.disabled,
                          }
                        })
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
              {!useRegex && (
                <Typography variant="caption" color="text.disabled">
                  * 请先开启“正则表达式”开关以使用
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Collapse>

      {/* 开关组：放在输入框正下方 */}
      <Box sx={{ pt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={caseSensitive}
              onChange={(e) => handleFieldChange('caseSensitive', e.target.checked)}
              disabled={isSearching}
            />
          }
          label={<Typography variant="body2">区分大小写</Typography>}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={wholeWord}
              onChange={(e) => handleFieldChange('wholeWord', e.target.checked)}
              disabled={isSearching}
            />
          }
          label={<Typography variant="body2">全词匹配</Typography>}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={useRegex}
              onChange={(e) => handleFieldChange('useRegex', e.target.checked)}
              disabled={isSearching}
            />
          }
          label={<Typography variant="body2">正则表达式</Typography>}
        />
      </Box>

      {/* --- 底部：搜索按钮 --- */}
      <Box sx={{ pt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        {!isSearching ? (
          <Button
            variant="contained"
            size="large" // 更大的按钮
            startIcon={<Search />}
            onClick={handleSearch}
            disabled={!searchQuery.trim() || files.length === 0}
            fullWidth // 填满宽度，更有气势
            sx={{
              height: 48,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              boxShadow: theme.shadows[4]
            }}
          >
            开始搜索
          </Button>
        ) : (
          <Button
            variant="outlined"
            size="large"
            color="error"
            startIcon={<Stop />}
            onClick={stopSearch}
            fullWidth
            sx={{ height: 48 }}
          >
            停止
          </Button>
        )}
      </Box>

      {/* 弹簧, 将按钮推到底部，把父容器里剩下的所有空白空间都占了 */}
      <Box sx={{ flex: 1 }} />

      {/* 底部统计 */}
      <Box sx={{ pt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {files.length > 0 ? `将在 ${files.length} 个文件中搜索` : '请先添加文件'}
        </Typography>
      </Box>

    </Box>
  );
};

export default SearchPanel;