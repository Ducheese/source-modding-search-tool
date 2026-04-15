import React, {
  useState,
  useRef,
  useEffect,
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
import { useSnackbar } from '../contexts/SnackbarContext';
import { useLanguage } from '../utils/i18n';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useSearchForm } from '../hooks/useSearchForm';
import { useAiRegex } from '../hooks/useAiRegex';
import { useRegexExplanation } from '../hooks/useRegexExplanation';
import { getRegexCategories } from '../config/regexCategories';

/**
 * 搜索面板组件
 */
const SearchPanel = ({ files, onSearch, onSearchStart, isSearching }) => {
  const theme = useTheme();
  const { t, lang } = useLanguage();
  const showSnackbar = useSnackbar();

  // 使用 hooks 管理状态
  const { history: searchHistory, save: saveSearchHistory } = useSearchHistory();
  const { state, setField, insertSnippet } = useSearchForm();
  const { generate: generateAiRegex, isGenerating: isAiGenerating, abort: abortAiRegex } = useAiRegex({ showSnackbar, t, lang });
  const { explain: explainRegex, isExplaining, explanation: regexExplanation, abort: abortExplanation, clear: clearExplanation } = useRegexExplanation({ t, lang });

  const { searchQuery, caseSensitive, wholeWord, useRegex, includePattern, excludePattern, moreContext, contextLines, aiRegex } = state;

  // 高级选项展开状态
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 用于输入正则快捷方式
  const searchInputRef = useRef(null);
  // 用于取消搜索：每次搜索时递增，stopSearch 时也递增，旧版本的结果会被丢弃
  const searchVersionRef = useRef(0);

  // 正则分类（响应语言变化）
  const REGEX_CATEGORIES = useMemo(() => getRegexCategories(t), [t]);

  // isSearching 变为 true 时，触发正则解释
  useEffect(() => {
    if (isSearching && (useRegex || aiRegex)) {
      explainRegex(searchQuery);
    }
  }, [isSearching, searchQuery, useRegex, aiRegex, explainRegex]);

  // // searchQuery 变化时清空旧解释，防止显示陈旧内容
  // useEffect(() => {
  //   clearExplanation();
  // }, [searchQuery, clearExplanation]);

  // 关闭正则模式时中断解释
  useEffect(() => {
    if (!useRegex && !aiRegex && isExplaining) {
      abortExplanation();
      showSnackbar(t('search.aborted'), 'warning');
    }
  }, [useRegex, aiRegex, isExplaining, showSnackbar, t, abortExplanation]);

  // 执行搜索
  const handleSearch = useCallback(async (overrideQuery, overrideUseRegex) => {
    const finalQuery = typeof overrideQuery === 'string' ? overrideQuery : searchQuery;
    const finalUseRegex = typeof overrideUseRegex === 'boolean' ? overrideUseRegex : useRegex;
    if (!finalQuery.trim() || files.length === 0) return;

    saveSearchHistory(finalQuery);
    onSearchStart();

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

      const results = await searchInFiles(files, searchOptions);

      if (searchVersionRef.current !== currentVersion) return;
      onSearch(results);
    } catch (error) {
      if (searchVersionRef.current !== currentVersion) return;
      console.error('Search failed:', error);
      onSearch({ error: error.message });
    }
  }, [searchQuery, useRegex, files, caseSensitive, wholeWord, includePattern, excludePattern, moreContext, contextLines, saveSearchHistory, onSearchStart, onSearch]);

  // AI 正则搜索
  const handleAiRegexSearch = useCallback(async () => {
    const intent = searchQuery.trim();
    if (!intent || files.length === 0) return;

    const regex = await generateAiRegex(intent);
    if (regex) {
      setField('searchQuery', regex);
      await handleSearch(regex, true);
    }
  }, [searchQuery, files, generateAiRegex, setField, handleSearch]);

  // 键盘事件
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      if (isAiGenerating) return;
      if (aiRegex) {
        handleAiRegexSearch();
      } else {
        handleSearch();
      }
    }
  }, [isAiGenerating, aiRegex, handleAiRegexSearch, handleSearch]);

  // 停止搜索
  const stopSearch = useCallback(() => {
    searchVersionRef.current++;
    onSearch(null);
  }, [onSearch]);

  // 插入正则片段
  const handleInsertSnippet = useCallback((snippet) => {
    insertSnippet(snippet);
    searchInputRef.current?.focus();
  }, [insertSnippet]);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>

      <Box sx={{ flex: 1 }} />

      <Typography variant="h6" gutterBottom fontWeight="700">
        {t('search.title')}
      </Typography>

      {/* 核心搜索区 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Autocomplete
          sx={{ flex: 1 }}
          freeSolo
          options={searchHistory}
          inputValue={searchQuery}
          onInputChange={(e, value, reason) => {
            if (reason === 'clear' && isAiGenerating) {
              abortAiRegex();
              showSnackbar(t('search.aborted'), 'warning');
            } else {
              setField('searchQuery', value);
            }
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
            const { key, ...otherProps } = props;
            return (
              <Box
                component="li"
                key={key}
                {...otherProps}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <History sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">{option}</Typography>
              </Box>
            );
          }}
        />
        <Tooltip title={t('search.advancedTooltip')}>
          <IconButton
            onClick={() => setShowAdvanced(!showAdvanced)}
            color={showAdvanced ? 'primary' : 'default'}
          >
            <FilterAlt />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 高级选项 */}
      <Collapse in={showAdvanced} timeout={0} unmountOnExit>
        <Grid container spacing={2} sx={{ pt: 1 }}>
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
                onChange={(e) => setField('includePattern', e.target.value)}
                helperText={t('search.includeHelper')}
                inputProps={{ style: { textOverflow: 'ellipsis' } }}
              />
              <TextField
                label={t('search.excludeLabel')}
                variant="outlined"
                size="small"
                fullWidth
                value={excludePattern}
                onChange={(e) => setField('excludePattern', e.target.value)}
                helperText={t('search.excludeHelper')}
                inputProps={{ style: { textOverflow: 'ellipsis' } }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ opacity: useRegex ? 1 : 0.6, transition: 'opacity 0.2s ease-in-out' }}>
              <Typography variant="subtitle2" gutterBottom color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Code fontSize="small" /> {t('search.regexShortcutsTitle')}
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '200px', overflowY: 'auto', pr: 1 }}>
                {REGEX_CATEGORIES.map((category) => (
                  <Box key={category.title}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary', fontWeight: '700', fontSize: '0.7rem' }}>
                      {category.title}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {category.items.map((snippet) => (
                        <Tooltip key={snippet.label + snippet.value + useRegex} title={t('search.insertSnippet', { value: snippet.value })}>
                          <Chip
                            label={snippet.label}
                            size="small"
                            onClick={() => handleInsertSnippet(snippet.value)}
                            clickable={useRegex}
                            color={useRegex ? "primary" : "default"}
                            variant="outlined"
                            sx={{
                              userSelect: 'none',
                              height: 24,
                              fontSize: '0.75rem',
                              cursor: useRegex ? 'pointer' : 'not-allowed',
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

              {!useRegex && (
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                  {t('search.regexHint')}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Collapse>

      {/* 开关组 */}
      <Box sx={{ pt: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip title={aiRegex ? t('search.caseSensitiveTooltipAi') : t('search.caseSensitiveTooltip')}>
          <Box>
            <FormControlLabel
              disabled={isSearching || aiRegex}
              control={<Switch size="small" checked={caseSensitive} onChange={(e) => setField('caseSensitive', e.target.checked)} />}
              label={<Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{t('search.caseSensitive')}</Typography>}
            />
          </Box>
        </Tooltip>

        <Tooltip title={useRegex ? t('search.wholeWordTooltipRegex') : t('search.wholeWordTooltip')}>
          <Box>
            <FormControlLabel
              disabled={isSearching || useRegex}
              control={<Switch size="small" checked={wholeWord} onChange={(e) => setField('wholeWord', e.target.checked)} />}
              label={<Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{t('search.wholeWord')}</Typography>}
            />
          </Box>
        </Tooltip>

        <FormControlLabel
          control={<Switch size="small" checked={useRegex} onChange={(e) => setField('useRegex', e.target.checked)} disabled={isSearching || aiRegex} />}
          label={<Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{t('search.useRegex')}</Typography>}
        />

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <FormControlLabel
            control={<Switch size="small" checked={moreContext} onChange={(e) => setField('moreContext', e.target.checked)} disabled={isSearching} />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                  {moreContext ? t('search.moreContextLines', { lines: contextLines }) : t('search.moreContext')}
                </Typography>
                {moreContext && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.25 }}>
                    <IconButton size="small" disabled={isSearching}
                      onClick={(e) => { e.preventDefault(); const v = parseInt(contextLines, 10); setField('contextLines', (isNaN(v) ? 4 : v) >= 10 ? 2 : v + 1); }}
                      sx={{ p: 0, width: 14, height: 10, color: 'text.secondary' }}>
                      <ExpandLess sx={{ fontSize: 12 }} />
                    </IconButton>
                    <IconButton size="small" disabled={isSearching}
                      onClick={(e) => { e.preventDefault(); const v = parseInt(contextLines, 10); setField('contextLines', (isNaN(v) ? 4 : v) <= 2 ? 10 : v - 1); }}
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
          control={<Switch size="small" checked={aiRegex} onChange={(e) => setField('aiRegex', e.target.checked)} disabled={isSearching || isAiGenerating} />}
          label={<Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{t('search.aiRegex')}</Typography>}
        />
      </Box>

      {/* 搜索按钮 */}
      <Box sx={{ pt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        {!isSearching ? (
          <Button
            key="start"
            variant="contained"
            size="large"
            startIcon={<Search />}
            onClick={() => aiRegex ? handleAiRegexSearch() : handleSearch()}
            disabled={!searchQuery.trim() || files.length === 0 || isAiGenerating}
            fullWidth
            sx={{ height: 48, fontSize: '1.1rem', fontWeight: '700', boxShadow: theme.shadows[4] }}
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
