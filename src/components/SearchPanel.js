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
} from '@mui/icons-material';
import { searchInFiles } from '../utils/searchEngine';
import { useSnackbar } from '../App';
import { tauriAPI } from '../utils/tauriBridge';
import { DEFAULT_AI_REGEX_PROMPT, DEFAULT_AI_REGEX_EXPLAIN_PROMPT, loadAiSettings } from '../utils/aiDefaults';

// 正则快捷片段
// 按类别分组的正则片段
const REGEX_CATEGORIES = [
  {
    title: '锚定符',
    items: [
      { label: '行首', value: '^' },
      { label: '行尾 (CRLF/LF)', value: '\\r?$' },
      { label: '单词边界', value: '\\b' },
      { label: '非单词边界', value: '\\B' },
    ]
  },
  {
    title: '通配字符',
    items: [
      { label: '任意字符', value: '.' },
      { label: '制表符', value: '\\t' },
      { label: '换行符 (CRLF/LF)', value: '\\r?\\n' },
      { label: '空格、制表或换行符', value: '\\s' },    // 空格 、制表符\t、换行符\r\n
      { label: '字母、数字或下划线', value: '\\w' },
      { label: '纯数字字符', value: '\\d' },
    ]
  },
  {
    title: '指定前面元素的出现次数',
    items: [
      { label: '0或1个 (?)', value: '?' },
      { label: '0或多个 (*)', value: '*' },
      { label: '1或多个 (+)', value: '+' },
      { label: '非贪婪 (*?)', value: '*?' },
      { label: '指定数量 {}', value: '{}' },
    ]
  },
  {
    title: '字符集的使用例',
    items: [
      { label: '十六进制颜色代码', value: '#[0-9a-fA-F]{6}' },
      { label: '指定数量中文字符', value: '[\\u4e00-\\u9fa5]{}' },
    ]
  },
  {
    title: '必须转义才能匹配其本身的字符',
    items: [
      { label: '(', value: '\\(' },
      { label: ')', value: '\\)' },
      { label: '[', value: '\\[' },
      { label: ']', value: '\\]' },
      { label: '{', value: '\\{' },
      { label: '}', value: '\\}' },
      { label: '.', value: '\\.' },
      { label: '?', value: '\\?' },
      { label: '*', value: '\\*' },
      { label: '+', value: '\\+' },
      { label: '^', value: '\\^' },
      { label: '$', value: '\\$' },
      { label: '\\', value: '\\\\' },
      { label: '-', value: '\\-' },
      { label: '|', value: '\\|' },
    ]
  },
  {
    title: '适用于CS起源的使用例',
    items: [
      { label: '匹配所有"weapon_xxx.single"', value: '^[ ]*"Weapon_[^\\.\\r\\n]+\\.Single"' },
      { label: '匹配所有武器脚本里的子弹数和种类定义', value: '"(clip_size|primary_ammo)"\\s+"[^"]+?"' },
      { label: '匹配所有用PropData的GetEntProp', value: 'GetEntProp\\s*\\(\\s*[^,)]+?\\s*,\\s*Prop_Data\\s*,\\s*"[^"]+?"\\s*\\)' }
    ]
  }
];

// 使用 useReducer 整合所有状态配置
const initialState = {
  searchQuery: '',
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
  includePattern: '',
  excludePattern: '',
  moreContext: false,
  aiRegex: false,
};

function searchReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      const { field, value } = action;

      if (field === 'aiRegex' && value === true) {
        return { ...state, aiRegex: true, useRegex: true, wholeWord: false, caseSensitive: false };
      }

      if (field === 'aiRegex' && value === false) {
        return { ...state, aiRegex: false, useRegex: false};
      }

      // 【敕令核心】在此处确立君臣之礼！
      // 当帝王（useRegex）登基（变为 true）之时...
      if (field === 'useRegex' && value === true) {
        // ...仆从（wholeWord）必须立刻退下（变为 false）！
        return { ...state, useRegex: true, wholeWord: false };
      }

      // 另，当仆从（wholeWord）想要上位（变为 true）时...
      if (field === 'wholeWord' && value === true) {
        // ...帝王（useRegex）必须早已退位（为 false）！
        // （这一步通过UI的disabled来保证，但以防万一，可以在此加强）
        return { ...state, wholeWord: true, useRegex: false };
      }

      // 其他情况，一切照旧
      return { ...state, [field]: value };

    case 'SET_REGEX_SNIPPET':
      // 插入咒语，等同于帝王登基
      return { ...state, searchQuery: state.searchQuery + action.value, useRegex: true, wholeWord: false };

    default:
      return state;
  }
}

const SearchPanel = ({ files, onSearch, onSearchStart, isSearching }) => {

  const theme = useTheme();

  // 使用 useReducer 统一管理搜索配置（initialState），避免了大量 useState 的堆砌
  const [state, dispatch] = useReducer(searchReducer, initialState);
  const { searchQuery, caseSensitive, wholeWord, useRegex, includePattern, excludePattern, moreContext, aiRegex } = state;

  const [searchHistory, setSearchHistory] = useState([]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // 新增：控制高级选项展开的状态
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 正则解释
  const [regexExplanation, setRegexExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);

  const explainRegex = async (regexStr) => {
    if (!regexStr.trim()) return;
    const settings = loadAiSettings();
    // 未配置 AI 则静默跳过，不打扰用户
    if (!settings.baseUrl || !settings.apiKey || !settings.modelName) return;

    setIsExplaining(true);
    setRegexExplanation('');
    try {
      const response = await tauriAPI.generateAiRegex({
        user_prompt: regexStr,
        system_prompt: DEFAULT_AI_REGEX_EXPLAIN_PROMPT,
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model_name: settings.modelName,
      });
      const explanation = response?.regex?.trim();
      if (explanation) setRegexExplanation(explanation);
    } catch (_) {
      // 静默失败，不影响主搜索流程
    } finally {
      setIsExplaining(false);
    }
  };

  // 用于输入正则快捷方式
  const searchInputRef = useRef(null);

  const showSnackbar = useSnackbar();

  // isSearching 变为 true 时，正则表达式已经落定（无论来自用户输入还是 AI 生成），统一触发解释
  useEffect(() => {
    if (isSearching && (useRegex || aiRegex)) {
      explainRegex(searchQuery);
    }
  }, [isSearching]);

  useEffect(() => {
    if (!useRegex && !aiRegex) {
      setRegexExplanation('');
    }
  }, [useRegex, aiRegex]);

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

  const handleSearch = async (overrideQuery, overrideUseRegex) => {
    // 【注意】这里不再需要前端计算 finalFilePaths 了！
    // 因为 searchInFiles 后端会自己做完全一致的过滤
    const finalQuery = typeof overrideQuery === 'string' ? overrideQuery : searchQuery;
    const finalUseRegex = typeof overrideUseRegex === 'boolean' ? overrideUseRegex : useRegex;
    if (!finalQuery.trim() || files.length === 0) return;

    saveSearchHistory(finalQuery);
    onSearchStart();

    try {
      const searchOptions = {
        query: finalQuery,
        caseSensitive,
        wholeWord,
        useRegex: finalUseRegex,
        includePattern,
        excludePattern,
        contextLines: moreContext ? 4 : 1,
      };

      // 直接把完整的文件列表扔给后端，让它自己去筛选！
      const results = await searchInFiles(files, searchOptions);
      onSearch(results);
    } catch (error) {
      console.error('Search failed:', error);
      onSearch({ error: error.message });
    }
  };

  const handleAiRegexSearch = async () => {

    const intent = searchQuery.trim();
    if (!intent || files.length === 0) return;

    const settings = loadAiSettings();
    if (!settings.baseUrl || !settings.apiKey || !settings.modelName) {
      showSnackbar(`请进入「关于与帮助」填写「大模型接入配置」`, 'warning');
      return;
    }

    setIsAiGenerating(true);
    try {
      const response = await tauriAPI.generateAiRegex({
        user_prompt: intent,
        system_prompt: settings.regexPrompt || DEFAULT_AI_REGEX_PROMPT,
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model_name: settings.modelName,
      });
      const regex = response?.regex?.trim();
      if (!regex) {
        throw new Error('未返回有效的正则表达式');
      }
      dispatch({ type: 'SET_FIELD', field: 'searchQuery', value: regex });
      await handleSearch(regex, true);
    } catch (error) {
      showSnackbar('已超时', 'error');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (isAiGenerating) return;  // 防止重复提交，收到两次输出
      if (aiRegex) {
        handleAiRegexSearch();
      } else {
        handleSearch();
      }
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

      <Typography variant="h6" gutterBottom fontWeight="700">
        搜索配置
      </Typography>

      {/* --- 核心搜索区 --- */}
      {/* 2. 【敕令】将“印章”移至框外，与主体并立 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
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
              placeholder={aiRegex ? '输入您的意图...' : '输入搜索内容...'}
              variant="outlined"
              size="small"
              onKeyPress={handleKeyPress}
              disabled={isSearching || isAiGenerating}
              helperText={
                (useRegex || aiRegex)
                  ? isExplaining
                    ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <CircularProgress size={10} thickness={5} />
                        正则解释中…
                      </Box>
                    : regexExplanation || undefined
                  : undefined
              }
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
                    {(isSearching || isAiGenerating) && <CircularProgress size={20} />}
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
        <Tooltip title="高级选项">
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
              <FilterList fontSize="small" /> 路径过滤通配符
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
            <Box sx={{ opacity: useRegex ? 1 : 0.6, transition: 'opacity 0.2s ease-in-out' }}>
              <Typography variant="subtitle2" gutterBottom color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Code fontSize="small" /> 正则快捷方式
              </Typography>

              {/* --- 修改开始：分类渲染 --- */}
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                // 如果条目太多，建议限制高度并允许滚动，否则会把搜索按钮挤出屏幕
                maxHeight: '200px',
                overflowY: 'auto',
                pr: 1 // 滚动条留白
              }}>
                {REGEX_CATEGORIES.map((category) => (
                  <Box key={category.title}>
                    {/* 分类标题 */}
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mb: 0.5,
                        color: 'text.secondary',
                        fontWeight: '700',
                        fontSize: '0.7rem'
                      }}
                    >
                      {category.title}
                    </Typography>

                    {/* 分类下的 Chips */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {category.items.map((snippet) => (
                        <Tooltip key={snippet.label + snippet.value} title={`插入 ${snippet.value}`}>
                          <Chip
                            label={snippet.label}
                            size="small"
                            onClick={() => insertRegexSnippet(snippet.value)}
                            clickable={useRegex}
                            color={useRegex ? "primary" : "default"}
                            variant="outlined"
                            // 这里的样式稍微调整紧凑一点
                            sx={{
                              userSelect: 'none',  // 禁止选中
                              height: 24,
                              fontSize: '0.75rem',
                              cursor: useRegex ? 'pointer' : 'not-allowed',
                              // 【敕令】当关闭时，让它变得灰暗，而不是改变形态
                              ...(!useRegex && {
                                borderColor: theme.palette.action.disabled,
                                color: theme.palette.action.disabled,
                              })
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
              {/* --- 修改结束 --- */}

              {!useRegex && (
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                  * 请先开启“正则表达式”开关以使用
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Collapse>

      {/* 开关组：放在输入框正下方 */}
      <Box sx={{ pt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Tooltip title={aiRegex ? "AI写正则模式已接管，请手动使用 (?i)" : "仅在非AI写正则模式下可用"}>
          <Box>
            <FormControlLabel
              disabled={isSearching || aiRegex}
              control={
                <Switch
                  size="small"
                  checked={caseSensitive}
                  onChange={(e) => handleFieldChange('caseSensitive', e.target.checked)}
                />
              }
              label={<Typography variant="body2">区分大小写</Typography>}
            />
          </Box>
        </Tooltip>

        {/* 【敕令核心】让仆从学会回避！ */}
        <Tooltip title={useRegex ? "正则表达式模式已接管，请手动使用 \\b" : "仅在非正则模式下可用"}>
          {/* 当帝王亲政时，这个开关必须被禁用，且呈现出“不可用”的卑微姿态 */}
          <Box> {/* Tooltip 需要一个非 disabled 的子元素来包裹 */}
            <FormControlLabel
              disabled={isSearching || useRegex} // **核心**
              control={
                <Switch
                  size="small"
                  checked={wholeWord}
                  onChange={(e) => handleFieldChange('wholeWord', e.target.checked)}
                />
              }
              label={<Typography variant="body2">全词匹配</Typography>}
            />
          </Box>
        </Tooltip>

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={useRegex}
                  onChange={(e) => handleFieldChange('useRegex', e.target.checked)}
                  disabled={isSearching || aiRegex}
                />
              }
              label={<Typography variant="body2">正则表达式</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={moreContext}
                  onChange={(e) => handleFieldChange('moreContext', e.target.checked)}
                  disabled={isSearching}
                />
              }
              label={<Typography variant="body2">更多上下文</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={aiRegex}
                  onChange={(e) => handleFieldChange('aiRegex', e.target.checked)}
                  disabled={isSearching || isAiGenerating}
                />
              }
              label={<Typography variant="body2">AI写正则</Typography>}
            />
          </Box>

      {/* --- 底部：搜索按钮 --- */}
      <Box sx={{ pt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        {!isSearching ? (
          <Button
            variant="contained"
            size="large" // 更大的按钮
            startIcon={<Search />}
            onClick={() => {
              if (aiRegex) {
                handleAiRegexSearch();
              } else {
                handleSearch();
              }
            }}
            disabled={!searchQuery.trim() || files.length === 0 || isAiGenerating}
            fullWidth // 填满宽度，更有气势
            sx={{
              height: 48,
              fontSize: '1.1rem',
              fontWeight: '700',
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
