export const SEARCH_HISTORY_STORAGE_KEY = 'searchHistory';

import React, {
  useState,
  useRef,
  useEffect,
  useReducer,
  useMemo,
  useCallback,
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
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { searchInFiles } from '../utils/searchEngine';
import { useSnackbar } from '../App';
import { tauriAPI } from '../utils/tauriBridge';
import { DEFAULT_AI_REGEX_PROMPT, DEFAULT_AI_EXPLAIN_PROMPT, loadAiSettings } from '../utils/aiDefaults';
import { useLanguage } from '../utils/i18n';

// 使用 useReducer 整合所有状态配置
const initialState = {
  searchQuery: '',
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
  includePattern: '',
  excludePattern: '',
  moreContext: false,
  contextLines: 4,
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
  const { t } = useLanguage();

  const REGEX_CATEGORIES = useMemo(() => [
    {
      title: t('regexCat.anchors'),
      items: [
        { label: t('regexSnippet.lineStart'),        value: '^' },
        { label: t('regexSnippet.lineEnd'),           value: '\\r?$' },
        { label: t('regexSnippet.wordBoundary'),      value: '\\b' },
        { label: t('regexSnippet.nonWordBoundary'),   value: '\\B' },
      ]
    },
    {
      title: t('regexCat.wildcards'),
      items: [
        { label: t('regexSnippet.anyChar'),    value: '.' },
        { label: t('regexSnippet.tab'),        value: '\\t' },
        { label: t('regexSnippet.newline'),    value: '\\r?\\n' },
        { label: t('regexSnippet.whitespace'), value: '\\s' },
        { label: t('regexSnippet.word'),       value: '\\w' },
        { label: t('regexSnippet.digit'),      value: '\\d' },
      ]
    },
    {
      title: t('regexCat.quantifiers'),
      items: [
        { label: t('regexSnippet.optional'),    value: '?' },
        { label: t('regexSnippet.zeroOrMore'),  value: '*' },
        { label: t('regexSnippet.oneOrMore'),   value: '+' },
        { label: t('regexSnippet.lazy'),        value: '*?' },
        { label: t('regexSnippet.count'),       value: '{}' },
      ]
    },
    {
      title: t('regexCat.charsets'),
      items: [
        { label: t('regexSnippet.hexColor'),  value: '#[0-9a-fA-F]{6}' },
        { label: t('regexSnippet.chineseCharCount'),  value: '[\\u4e00-\\u9fa5]{}' },
      ]
    },
    {
      title: t('regexCat.escape'),
      items: [
        { label: '(', value: '\\(' }, { label: ')', value: '\\)' },
        { label: '[', value: '\\[' }, { label: ']', value: '\\]' },
        { label: '{', value: '\\{' }, { label: '}', value: '\\}' },
        { label: '.', value: '\\.' }, { label: '?', value: '\\?' },
        { label: '*', value: '\\*' }, { label: '+', value: '\\+' },
        { label: '^', value: '\\^' }, { label: '$', value: '\\$' },
        { label: '\\', value: '\\\\' }, { label: '-', value: '\\-' },
        { label: '|', value: '\\|' },
      ]
    },
    {
      title: t('regexCat.csExamples'),
      items: [
        { label: t('regexSnippet.csWeapon'),   value: '^[ ]*"Weapon_[^\\.\\r\\n]+\\.Single"' },
        { label: t('regexSnippet.csAmmo'),     value: '"(clip_size|primary_ammo)"\\s+"[^"]+?"' },
        { label: t('regexSnippet.csPropData'), value: 'GetEntProp\\s*\\(\\s*[^,)]+?\\s*,\\s*Prop_Data\\s*,\\s*"[^"]+?"\\s*\\)' },
      ]
    },
  ], [t]);

  // 使用 useReducer 统一管理搜索配置（initialState），避免了大量 useState 的堆砌
  const [state, dispatch] = useReducer(searchReducer, initialState);
  const { searchQuery, caseSensitive, wholeWord, useRegex, includePattern, excludePattern, moreContext, contextLines, aiRegex } = state;

  const [searchHistory, setSearchHistory] = useState([]);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // 新增：控制高级选项展开的状态
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 正则解释
  const [regexExplanation, setRegexExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);

  const explainRegex = useCallback(async (regexStr) => {
    if (!regexStr.trim()) return;
    const settings = loadAiSettings();
    // 未配置 AI 则静默跳过，不打扰用户
    if (!settings.baseUrl || !settings.apiKey || (!settings.explainModelName && !settings.regexModelName)) return;

    setIsExplaining(true);
    setRegexExplanation('');
    explainAbortedRef.current = false;
    try {
      const response = await tauriAPI.generateAiRegex({
        user_prompt: regexStr,
        system_prompt: settings.explainPrompt || DEFAULT_AI_EXPLAIN_PROMPT,
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model_name: settings.explainModelName || settings.regexModelName,
      });
      if (explainAbortedRef.current) return;
      const explanation = response?.regex?.trim();
      if (explanation) setRegexExplanation(explanation);
    } catch (_) {
      // 静默失败，不影响主搜索流程
    } finally {
      setIsExplaining(false);
    }
  }, []);

  // 用于输入正则快捷方式
  const searchInputRef = useRef(null);
  // 用于中断 AI 写正则：置为 true 后，响应回来时结果会被丢弃
  const regexAbortedRef = useRef(false);
  // 用于中断正则解释：关闭正则模式时置为 true，响应回来时结果会被丢弃
  const explainAbortedRef = useRef(false);
  // 用于取消搜索：每次搜索时递增，stopSearch 时也递增，旧版本的结果会被丢弃
  const searchVersionRef = useRef(0);

  const showSnackbar = useSnackbar();

  // isSearching 变为 true 时，正则表达式已经落定（无论来自用户输入还是 AI 生成），统一触发解释
  useEffect(() => {
    if (isSearching && (useRegex || aiRegex)) {
      explainRegex(searchQuery);
    }
  }, [isSearching, searchQuery, useRegex, aiRegex, explainRegex]);

  useEffect(() => {
    if (!useRegex && !aiRegex && isExplaining) {
      explainAbortedRef.current = true;
      setIsExplaining(false);
      setRegexExplanation('');
      showSnackbar(t('search.aborted'), 'warning');
    }
  }, [useRegex, aiRegex, isExplaining, showSnackbar, t]);

  // 从 localStorage 加载搜索历史
  useEffect(() => {
    const savedHistory = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Failed to load search history:', error);
      }
    }
  }, []);

  // 保存搜索历史到 localStorage
  const saveSearchHistory = useCallback((query) => {
    if (!query.trim()) return;

    setSearchHistory(prev => {
      const newHistory = [query, ...prev.filter(h => h !== query)].slice(0, 30);
      localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const handleSearch = useCallback(async (overrideQuery, overrideUseRegex) => {
    // 【注意】这里不再需要前端计算 finalFilePaths 了！
    // 因为 searchInFiles 后端会自己做完全一致的过滤
    const finalQuery = typeof overrideQuery === 'string' ? overrideQuery : searchQuery;
    const finalUseRegex = typeof overrideUseRegex === 'boolean' ? overrideUseRegex : useRegex;
    if (!finalQuery.trim() || files.length === 0) return;

    saveSearchHistory(finalQuery);
    onSearchStart();

    // 递增搜索版本号，记录当前版本
    const currentVersion = ++searchVersionRef.current;

    try {
      const searchOptions = {
        query: finalQuery,
        caseSensitive,
        wholeWord,
        useRegex: finalUseRegex,
        includePattern,
        excludePattern,
        contextLines: moreContext ? contextLines : 1,
      };

      // 直接把完整的文件列表扔给后端，让它自己去筛选！
      const results = await searchInFiles(files, searchOptions);

      // 检查版本号：如果不匹配说明搜索已被取消，丢弃结果
      if (searchVersionRef.current !== currentVersion) return;

      onSearch(results);
    } catch (error) {
      // 检查版本号：如果不匹配说明搜索已被取消，丢弃错误
      if (searchVersionRef.current !== currentVersion) return;

      console.error('Search failed:', error);
      onSearch({ error: error.message });
    }
  }, [searchQuery, useRegex, files, caseSensitive, wholeWord, includePattern, excludePattern, moreContext, contextLines, saveSearchHistory, onSearchStart, onSearch]);

  const handleAiRegexSearch = useCallback(async () => {

    const intent = searchQuery.trim();
    if (!intent || files.length === 0) return;

    const settings = loadAiSettings();
    if (!settings.baseUrl || !settings.apiKey || !settings.regexModelName) {
      showSnackbar(t('search.aiConfigHint'), 'warning');
      return;
    }

    setIsAiGenerating(true);
    regexAbortedRef.current = false;
    try {
      const response = await tauriAPI.generateAiRegex({
        user_prompt: intent,
        system_prompt: settings.regexPrompt || DEFAULT_AI_REGEX_PROMPT,
        api_key: settings.apiKey,
        base_url: settings.baseUrl,
        model_name: settings.regexModelName,
      });
      if (regexAbortedRef.current) return;
      const regex = response?.regex?.trim();
      if (!regex) {
        throw new Error(t('search.noRegex'));
      }
      dispatch({ type: 'SET_FIELD', field: 'searchQuery', value: regex });
      await handleSearch(regex, true);
    } catch (error) {
      showSnackbar(t('search.timeout'), 'error');
    } finally {
      setIsAiGenerating(false);
    }
  }, [searchQuery, files, showSnackbar, t, handleSearch]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      if (isAiGenerating) return;  // 防止重复提交，收到两次输出
      if (aiRegex) {
        handleAiRegexSearch();
      } else {
        handleSearch();
      }
    }
  }, [isAiGenerating, aiRegex, handleAiRegexSearch, handleSearch]);

  const stopSearch = useCallback(() => {
    // 递增版本号，使正在进行的搜索结果被丢弃
    searchVersionRef.current++;
    onSearch(null); // 清空状态
  }, [onSearch]);

  const insertRegexSnippet = useCallback((snippet) => {
    dispatch({ type: 'SET_REGEX_SNIPPET', value: snippet });
    searchInputRef.current?.focus();
  }, []);

  // 通用字段更新处理器
  const handleFieldChange = useCallback((field, value) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* 弹簧, 将按钮推到底部，把父容器里剩下的所有空白空间都占了 */}
      <Box sx={{ flex: 1 }} />

      <Typography variant="h6" gutterBottom fontWeight="700">
        {t('search.title')}
      </Typography>

      {/* --- 核心搜索区 --- */}
      {/* 2. 【敕令】将“印章”移至框外，与主体并立 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Autocomplete
          sx={{ flex: 1 }} // 让 Autocomplete 占据大部分空间
          freeSolo
          options={searchHistory}
          inputValue={searchQuery}
          onInputChange={(e, value, reason) => {
            if (reason === 'clear' && isAiGenerating) {
              regexAbortedRef.current = true;
              setIsAiGenerating(false);
              showSnackbar(t('search.aborted'), 'warning');
            }
            else // 只中断不清空
              handleFieldChange('searchQuery', value);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={searchInputRef}
              placeholder={aiRegex ? t('search.aiPlaceholder') : t('search.placeholder')}
              variant="outlined"
              size="small"
              onKeyPress={handleKeyPress}
              disabled={isSearching || isAiGenerating}
              helperText={
                (useRegex || aiRegex)
                  ? isExplaining
                    ? <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <CircularProgress size={10} thickness={5} />
                        {t('search.aiExplaining')}
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
        <Tooltip title={t('search.advancedTooltip')}>
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
              <FilterList fontSize="small" /> {t('search.pathFilterTitle')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField
                label={t('search.includeLabel')}
                variant="outlined"
                size="small"
                fullWidth
                value={includePattern}
                onChange={(e) => handleFieldChange('includePattern', e.target.value)}
                helperText={t('search.includeHelper')}
                inputProps={{ style: { textOverflow: 'ellipsis' } }}
              />
              <TextField
                label={t('search.excludeLabel')}
                variant="outlined"
                size="small"
                fullWidth
                value={excludePattern}
                onChange={(e) => handleFieldChange('excludePattern', e.target.value)}
                helperText={t('search.excludeHelper')}
                inputProps={{ style: { textOverflow: 'ellipsis' } }}
              />
            </Box>
          </Grid>

          {/* 右侧：正则辅助 (仅在开启正则时高亮，否则淡化) */}
          <Grid item xs={12} md={6}>
            <Box sx={{ opacity: useRegex ? 1 : 0.6, transition: 'opacity 0.2s ease-in-out' }}>
              <Typography variant="subtitle2" gutterBottom color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Code fontSize="small" /> {t('search.regexShortcutsTitle')}
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
                        <Tooltip key={snippet.label + snippet.value} title={t('search.insertSnippet', { value: snippet.value })}>
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
                  {t('search.regexHint')}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Collapse>

      {/* 开关组：放在输入框正下方 */}
      <Box sx={{ pt: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip title={aiRegex ? t('search.caseSensitiveTooltipAi') : t('search.caseSensitiveTooltip')}>
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
              label={<Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{t('search.caseSensitive')}</Typography>}
            />
          </Box>
        </Tooltip>

        {/* 【敕令核心】让仆从学会回避！ */}
        <Tooltip title={useRegex ? t('search.wholeWordTooltipRegex') : t('search.wholeWordTooltip')}>
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
              label={<Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{t('search.wholeWord')}</Typography>}
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
              label={<Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{t('search.useRegex')}</Typography>}
            />
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={moreContext}
                    onChange={(e) => handleFieldChange('moreContext', e.target.checked)}
                    disabled={isSearching}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                      {moreContext ? t('search.moreContextLines', { lines: contextLines }) : t('search.moreContext')}
                    </Typography>
                    {moreContext && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.25 }}>
                        <IconButton size="small" disabled={isSearching}
                          onClick={(e) => { e.preventDefault(); const v = parseInt(contextLines, 10); handleFieldChange('contextLines', (isNaN(v) ? 4 : v) >= 10 ? 2 : v + 1); }}
                          sx={{ p: 0, width: 14, height: 10, color: 'text.secondary' }}>
                          <ExpandLess sx={{ fontSize: 12 }} />
                        </IconButton>
                        <IconButton size="small" disabled={isSearching}
                          onClick={(e) => { e.preventDefault(); const v = parseInt(contextLines, 10); handleFieldChange('contextLines', (isNaN(v) ? 4 : v) <= 2 ? 10 : v - 1); }}
                          sx={{ p: 0, width: 14, height: 10, color: 'text.secondary' }}>
                          <ExpandMore sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                }
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={aiRegex}
                  onChange={(e) => handleFieldChange('aiRegex', e.target.checked)}
                  disabled={isSearching || isAiGenerating}
                />
              }
              label={<Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{t('search.aiRegex')}</Typography>}
            />
          </Box>

      {/* --- 底部：搜索按钮 --- */}
      <Box sx={{ pt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        {!isSearching ? (
          <Button
            key="start"
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
            {t('search.start')}
          </Button>
        ) : (
          <Button
            key="stop"
            variant="outlined"
            size="large"
            color="error"
            startIcon={<Stop />}
            onClick={stopSearch}
            fullWidth
            sx={{ height: 48 }}
          >
            {t('search.stop')}
          </Button>
        )}
      </Box>

      {/* 弹簧, 将按钮推到底部，把父容器里剩下的所有空白空间都占了 */}
      <Box sx={{ flex: 1 }} />

      {/* 底部统计 */}
      <Box sx={{ pt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {files.length > 0 ? t('search.fileCount', { count: files.length }) : t('search.noFiles')}
        </Typography>
      </Box>

    </Box>
  );
};

export default SearchPanel;
