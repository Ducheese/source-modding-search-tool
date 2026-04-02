import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Tabs,
  Tab,
  TextField,
  Button,
  Tooltip,
  CircularProgress,
  Alert,
  Collapse,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import { Close, Help, CheckCircle, ExpandMore, ExpandLess, Error, Feedback } from '@mui/icons-material';
import { tauriAPI } from '../utils/tauriBridge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getVersion } from '@tauri-apps/api/app';
import { homeDir } from '@tauri-apps/api/path';

import { useSnackbar, useThemeScheme } from '../App';
import { useLanguage } from '../utils/i18n';
import { COLOR_SCHEMES } from '../utils/themeConfig';
import { getMarkdownStyles } from '../utils/markdownStyles';
import { 
  DEFAULT_AI_REGEX_PROMPT, 
  DEFAULT_AI_CHAT_PROMPT, 
  DEFAULT_AI_EXPLAIN_PROMPT, 
  loadAiSettings, 
  AI_SETTINGS_STORAGE_KEY 
} from '../utils/aiDefaults';
import FeedbackForm from './FeedbackForm';

// ─────────────────────────────────────────────────────────────
// TabPanel
// ─────────────────────────────────────────────────────────────
const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2, px: 1 }}><Typography component="div">{children}</Typography></Box>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SchemeCard — 单张配色卡片
// ─────────────────────────────────────────────────────────────
const SchemeCard = ({ scheme, selected, darkMode, onClick }) => {
  const theme = useTheme();
  const { t } = useLanguage();
  const primary   = darkMode ? scheme.darkPrimary   : scheme.lightPrimary;
  const secondary = darkMode ? scheme.darkSecondary : scheme.lightSecondary;

  return (
    <Tooltip title={scheme.desc} arrow>
      <Box
        onClick={onClick}
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          borderRadius: 2,
          cursor: 'pointer',
          border: selected
            ? `2px solid ${theme.palette.primary.main}`
            : `2px solid ${theme.palette.divider}`,
          bgcolor: selected
            ? (t) => `${t.palette.primary.main}14`
            : 'background.paper',
          transition: 'border-color 0.2s, background-color 0.2s, transform 0.15s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 3,
          },
          minWidth: 88,
        }}
      >
        {/* 色块预览 */}
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {/* 主色 */}
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: primary,
              boxShadow: `0 2px 6px ${primary}88`,     // 据说是 MD3 的 Tonal Shadow 做法，不过挺有质感的，像在发光一样
              border: '2px solid rgba(255,255,255,0.25)',
            }}
          />
          {/* 副色 */}
          <Box
            sx={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: secondary,
              boxShadow: `0 2px 4px ${secondary}88`,
              border: '2px solid rgba(255,255,255,0.25)',
              alignSelf: 'flex-end',
              mb: '2px',
            }}
          />
        </Box>

        {/* 名称 */}
        <Typography
          variant="caption"
          fontWeight={selected ? 700 : 400}
          sx={{ color: selected ? 'primary.main' : 'text.secondary', lineHeight: 1.2, textAlign: 'center' }}
        >
          {t(scheme.labelKey)}
        </Typography>

        {/* 已选中角标 */}
        {selected && (
          <CheckCircle
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              fontSize: 16,
              color: 'primary.main',
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
};

// ─────────────────────────────────────────────────────────────
// ReleaseEntry — 单条更新日志（折叠/展开）
// ─────────────────────────────────────────────────────────────
const ReleaseEntry = ({ tag, name, body, date, markdownStyles, defaultExpanded = false, isLatest = false, isCurrent = false, isUpToDate = false, t }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => { setExpanded(defaultExpanded); }, [defaultExpanded]);
  const theme = useTheme();
  return (
    <Box sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}` }}>

      <Box
        onClick={() => setExpanded(v => !v)}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          py: 1.5, px: 1, cursor: 'pointer', userSelect: 'none',
          borderRadius: 1,
          '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.08) },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {date && (
            <Typography variant="caption" color="text.secondary">{date}</Typography>
          )}
          <Typography variant="body2" fontWeight={700}>{name}</Typography>
          {name !== tag && (
            <Chip label={tag} size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
          )}
          {isLatest && (
            <Chip label={t('help.changelog.latest')} size="small" color="error" sx={{ height: 20, fontSize: '0.68rem' }} />
          )}
          {isCurrent && (
            <Chip label={t('help.changelog.current')} size="small" color="info" sx={{ height: 20, fontSize: '0.68rem' }} />
          )}
          {isUpToDate && (
            <Chip label={t('help.changelog.upToDate')} size="small" color="success" sx={{ height: 20, fontSize: '0.68rem' }} />
          )}
        </Box>
        {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ px: 1, pb: 2, ...markdownStyles }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
        </Box>
      </Collapse>

    </Box>
  );
};

// ─────────────────────────────────────────────────────────────
// HelpDialog
// ─────────────────────────────────────────────────────────────
const HelpDialog = ({ open, onClose }) => {
  const [tabValue, setTabValue] = useState(0);
  const [aiSettings, setAiSettings] = useState(loadAiSettings());
  const [isTesting, setIsTesting] = useState(false);
  const handleTabChange = (_, newValue) => setTabValue(newValue);

  const [changelog, setChangelog] = useState(null);   // null=未加载, 'loading', 'error', [{tag, body}]
  const [currentVersion, setCurrentVersion] = useState(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [configPath, setConfigPath] = useState(null);

  const showSnackbar = useSnackbar();
  const { t } = useLanguage();

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const { schemeId, setSchemeId } = useThemeScheme();

  const markdownStyles = useMemo(() => getMarkdownStyles(theme), [theme]);

  useEffect(() => {
    if (!open) return;
    setAiSettings(loadAiSettings());
    if (changelog !== null) return;

    // 获取配置文件路径 - 只在首次打开帮助对话框时执行一次 - 因为 changelog !== null 会阻止后续执行
    homeDir().then(home => {
      if (home) {
        // Windows: C:\Users\YourName\AppData\Local\com.sourcemodding.searchtool
        const path = `${home}\\AppData\\Local\\com.sourcemodding.searchtool`;
        setConfigPath(path);
      }
    }).catch((err) => {
      console.error('Failed to find config folder:', err);
    });

    setChangelog('loading');
    getVersion().catch(() => null).then(v => {
      setCurrentVersion(v);
      fetch('https://api.github.com/repos/Ducheese/source-modding-search-tool/releases')
        .then(r => r.json())
        .then(data => {
          if (!Array.isArray(data)) {
            const isRateLimit = data?.message?.toLowerCase().includes('rate limit');
            setChangelog(isRateLimit ? 'ratelimit' : 'error');
            return;
          }
          const parsed = data.map(r => ({
            tag: r.tag_name,
            name: r.name || r.tag_name,
            body: (r.body || t('help.changelog.noBody'))
              .replace(/<img\b[^>]*>/gi, '')   // HTML img 标签（含 GitHub 的非自闭合形式）
              .trim(),
            date: r.published_at ? r.published_at.slice(0, 10) : null,  // 只取 yyyy-mm-dd
          }));
          setChangelog(parsed);
          // 检查更新：找到当前版本对应的 release 日期，和最新 release 日期比较
          const latestDate = parsed[0]?.date;
          const currentRelease = parsed.find(r => r.tag.replace(/^v/, '') === v);
          const currentDate = currentRelease?.date;
          if (latestDate && currentDate && latestDate > currentDate) {
            setHasUpdate(true);
          }
        })
        .catch(() => setChangelog('error'));
    });
  }, [open]);

  const handleAiSettingChange = (field, value) => {
    setAiSettings(prev => {
      const next = { ...prev, [field]: value };
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleTestConnection = async () => {
    if (!aiSettings.baseUrl.trim() || !aiSettings.apiKey.trim() || 
    (!aiSettings.regexModelName.trim() && !aiSettings.chatModelName.trim() && !aiSettings.explainModelName.trim())) {
      showSnackbar(t('help.fillRequired'), 'warning');
      return;
    }

    setIsTesting(true);
    try {
      await tauriAPI.testAiConnection({
        user_prompt: 'Reply with OK only',
        system_prompt: 'You are a test assistant. Reply directly with what the user requests, no extra information.',
        api_key: aiSettings.apiKey,
        base_url: aiSettings.baseUrl,
        model_name: aiSettings.regexModelName || aiSettings.chatModelName || aiSettings.explainModelName,
      });
      showSnackbar(t('help.connectionSuccess'), 'success');
    } catch (error) {
      showSnackbar(t('help.connectionFailed'), 'error');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>

      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          {/* 标题部分 */}
          <Typography variant="h6" component="h1" fontWeight="700" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Help sx={{ color: 'primary.main' }} />
            {t('help.title')}
          </Typography>
          {/* 关闭按钮部分 */}
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* 介绍 / 说明 / 配置存储：选中大模型接入配置、配色方案、更新日志、翻译反馈 Tab 时隐藏 */}
        {(tabValue !== 2 && tabValue !== 3 && tabValue !== 4 && tabValue !== 5) && <>
        {/* 介绍 */}
        <Box sx={{ mb: 3, px: 1, display: 'flex', alignItems: 'flex-start', gap: 3 }}>
          <Box
            component="img"
            src="/logos/ChatGPT Image 2026-03-12.png"
            alt={t('help.appIconAlt')}
            sx={{ width: 72, height: 72, borderRadius: 2, flexShrink: 0, mt: 0.5 }}
          />
          <Typography dangerouslySetInnerHTML={{ __html: t('help.intro') }} />
        </Box>

        {/* 说明 */}
        <Box sx={{ mb: 3, px: 1 }}>
          <Typography>{t('help.usage')}</Typography>
        </Box>

        {/* 配置存储 */}
        <Box sx={{ mb: 2, px: 1 }}>
          <Typography>
            {(() => {
              const storageText = t('help.storage');
              const [before, after] = storageText.split('{path}');
              const displayPath = '.\\AppData\\Local\\com.sourcemodding.searchtool';
              return (
                <>
                  {before}
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!configPath) return;
                      try {
                        await tauriAPI.openFileExternally(configPath);
                      } catch (err) {
                        console.error('Failed to open config folder:', err);
                      }
                    }}
                    style={{
                      color: theme.palette.primary.main,
                      textDecoration: 'underline',
                      cursor: configPath ? 'pointer' : 'default',
                      opacity: configPath ? 1 : 0.6,
                      fontFamily: 'Consolas, "Courier New", monospace',
                      fontSize: '0.9em',
                      // wordBreak: 'break-all',
                    }}
                  >
                    {displayPath}
                  </a>
                  {after}
                </>
              );
            })()}
          </Typography>
        </Box>

        </>}

        {/* ── Tabs ── */}
        <Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
              <Tab label={t('help.tab.pathFilter')}
              sx={{ 
                whiteSpace: 'normal', // 允许换行
                maxWidth: 180
              }}/>
              <Tab label={t('help.tab.regex')}
              sx={{ 
                whiteSpace: 'normal', // 允许换行
                maxWidth: 180
              }}/>
              <Tab label={t('help.tab.aiConfig')}
              sx={{ 
                whiteSpace: 'normal', // 允许换行
                maxWidth: 180
              }}/>
              <Tab label={t('help.tab.colorScheme')}
              sx={{ 
                whiteSpace: 'normal', // 允许换行
                maxWidth: 180
              }}/>
              <Tab label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {t('help.tab.changelog')}
                  {hasUpdate && <Error sx={{ fontSize: 16, color: 'error.main' }} />}
                </Box>
              }
              sx={{ 
                whiteSpace: 'normal', // 允许换行
                maxWidth: 180
              }}/>
              <Tab label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Feedback sx={{ fontSize: 16 }} />
                  Feedback
                </Box>
              }
              sx={{ 
                whiteSpace: 'normal', // 允许换行
                maxWidth: 180
              }}/>
            </Tabs>
          </Box>

          {/* Tab 0 — path filter */}
          <TabPanel value={tabValue} index={0}>
            <Typography component="div">
              <p dangerouslySetInnerHTML={{ __html: t('help.pathFilter.intro') }} style={{ margin: 0 }} />
              <ul>
                <li dangerouslySetInnerHTML={{ __html: t('help.pathFilter.rule1') }} />
                <li dangerouslySetInnerHTML={{ __html: t('help.pathFilter.rule2') }} />
                <li dangerouslySetInnerHTML={{ __html: t('help.pathFilter.rule3') }} />
                <li dangerouslySetInnerHTML={{ __html: t('help.pathFilter.rule4') }} />
              </ul>
            </Typography>
          </TabPanel>

          {/* Tab 1 — regex tips */}
          <TabPanel value={tabValue} index={1}>
            <Typography component="div">
              <p dangerouslySetInnerHTML={{ __html: t('help.regex.intro') }} style={{ margin: 0 }} />
              <ul>
                <li dangerouslySetInnerHTML={{ __html: t('help.regex.rule1') }} />
                <li dangerouslySetInnerHTML={{ __html: t('help.regex.rule2') }} />
              </ul>
            </Typography>
          </TabPanel>

          {/* Tab 2 — 大模型接入配置 */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* 说明文字 */}
              <Typography variant="body2" color="text.secondary">
                {t('help.aiConfig.desc')}
              </Typography>

              <TextField
                label="API Base Url"
                value={aiSettings.baseUrl}
                onChange={(e) => handleAiSettingChange('baseUrl', e.target.value)}
                placeholder="https://openrouter.ai/api/v1"
                helperText={t('help.apiBaseUrlHelper')}
                size="small"
                inputProps={{ style: { textOverflow: 'ellipsis' } }}
              />
              <TextField
                label="API Key"
                value={aiSettings.apiKey}
                onChange={(e) => handleAiSettingChange('apiKey', e.target.value)}
                type="password"
                placeholder="sk-xxx"
                helperText={t('help.apiKeyHelper')}
                size="small"
                inputProps={{ style: { textOverflow: 'ellipsis' } }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label={t('help.regexModel')}
                  value={aiSettings.regexModelName}
                  onChange={(e) => handleAiSettingChange('regexModelName', e.target.value)}
                  placeholder="qwen/qwen3.5-9b"
                  helperText={t('help.regexModelHelper')}
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{ style: { textOverflow: 'ellipsis' } }}
                />
                <TextField
                  label={t('help.chatModel')}
                  value={aiSettings.chatModelName}
                  onChange={(e) => handleAiSettingChange('chatModelName', e.target.value)}
                  placeholder="deepseek/deepseek-v3.2"
                  helperText={t('help.chatModelHelper')}
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{ style: { textOverflow: 'ellipsis' } }}
                />
                <TextField
                  label={t('help.explainModel')}
                  value={aiSettings.explainModelName}
                  onChange={(e) => handleAiSettingChange('explainModelName', e.target.value)}
                  placeholder="qwen/qwen3.5-9b"
                  helperText={t('help.explainModelHelper')}
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{ style: { textOverflow: 'ellipsis' } }}
                />
              </Box>
              <TextField
                label={t('help.regexPromptLabel')}
                value={aiSettings.regexPrompt}
                onChange={(e) => handleAiSettingChange('regexPrompt', e.target.value)}
                helperText={t('help.regexPromptHelper')}
                multiline
                minRows={6}
                maxRows={18}
              />
              <TextField
                label={t('help.chatPromptLabel')}
                value={aiSettings.chatPrompt}
                onChange={(e) => handleAiSettingChange('chatPrompt', e.target.value)}
                helperText={t('help.chatPromptHelper')}
                multiline
                minRows={6}
                maxRows={18}
              />
              <TextField
                label={t('help.explainPromptLabel')}
                value={aiSettings.explainPrompt}
                onChange={(e) => handleAiSettingChange('explainPrompt', e.target.value)}
                helperText={t('help.explainPromptHelper')}
                multiline
                minRows={6}
                maxRows={18}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                      handleAiSettingChange('regexPrompt', DEFAULT_AI_REGEX_PROMPT)
                      handleAiSettingChange('chatPrompt', DEFAULT_AI_CHAT_PROMPT)
                      handleAiSettingChange('explainPrompt', DEFAULT_AI_EXPLAIN_PROMPT)
                    }
                  }
                >
                  {t('help.resetPrompts')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                >
                  {isTesting ? t('help.testing') : t('help.testConnection')}
                </Button>
              </Box>
            </Box>
          </TabPanel>

          {/* Tab 3 — 外观设置（配色方案） */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

              {/* 说明文字 */}
              <Typography variant="body2" color="text.secondary">
                {t('help.colorScheme.desc')}
              </Typography>

              {/* 配色卡片行 */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 2,
                  alignItems: 'flex-start',
                }}
              >
                {COLOR_SCHEMES.map((scheme) => (
                  <SchemeCard
                    key={scheme.id}
                    scheme={scheme}
                    selected={schemeId === scheme.id}
                    darkMode={isDark}
                    onClick={() => {
                      setSchemeId(scheme.id);
                      showSnackbar(t('help.schemeSwitched', { label: t(scheme.labelKey) }), 'info');
                    }}
                  />
                ))}
              </Box>

              {/* 当前配色的色值预览 */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  bgcolor: 'background.paper',
                  // width: 'fit-content',  // 如果要自适应宽度
                }}
              >
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  {t('help.colorScheme.current', { label: t(COLOR_SCHEMES[schemeId].labelKey), desc: COLOR_SCHEMES[schemeId].desc })}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Primary',        color: theme.palette.primary.main },
                    { label: 'Pri. Dark',      color: theme.palette.primary.dark },
                    { label: 'Secondary',      color: theme.palette.secondary.main },
                    { label: 'Sec. Dark',      color: theme.palette.secondary.dark },
                    { label: 'Background',     color: theme.palette.background.default },
                    { label: 'Surface',        color: theme.palette.background.paper },
                    { label: 'Error',          color: theme.palette.error.main },
                  ].map(({ label, color }) => (
                    <Tooltip title={color} arrow key={label}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, width: 56 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1,
                            bgcolor: color,
                            border: `1px solid ${theme.palette.divider}`,
                            boxShadow: 1,
                          }}
                        />
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                          {label}
                        </Typography>
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              </Box>

            </Box>
          </TabPanel>

          {/* Tab 4 — 更新日志 */}
          <TabPanel value={tabValue} index={4}>
            {changelog === null || changelog === 'loading' ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : changelog === 'ratelimit' ? (
              <Alert severity="info">
                {t('help.changelog.rateLimit')}
                {' '}<a href="https://github.com/Ducheese/source-modding-search-tool/releases" target="_blank" rel="noopener noreferrer">{t('help.changelog.rateLimitLink')}</a>
              </Alert>
            ) : changelog === 'error' ? (
              <Alert
                severity="warning"
                action={<Button size="small" onClick={() => setChangelog(null)}>{t('help.changelog.retry')}</Button>}
              >
                {t('help.changelog.error')}
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {changelog.map(({ tag, name, body, date }, index) => (
                  <ReleaseEntry
                    key={tag} tag={tag} name={name} body={body} date={date}
                    markdownStyles={markdownStyles} t={t} defaultExpanded={index === 0 && hasUpdate}
                    isLatest={index === 0 && hasUpdate}
                    isCurrent={!!(currentVersion && tag.replace(/^v/, '') === currentVersion && hasUpdate)}
                    isUpToDate={!!(currentVersion && tag.replace(/^v/, '') === currentVersion && !hasUpdate)}
                  />
                ))}
              </Box>
            )}
          </TabPanel>

          {/* Tab 5 — 翻译反馈 */}
          <TabPanel value={tabValue} index={5}>
            <FeedbackForm />
          </TabPanel>

        </Box>

        {/* 超链接 */}
        <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="caption">
            <a href="https://github.com/Ducheese/source-modding-search-tool/tree/feat/i18n" target="_blank" rel="noopener noreferrer" style={{ color: theme.palette.primary.main }}>
              {t('help.github')}
            </a>
            <a href="https://space.bilibili.com/1889622121" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '12px', color: theme.palette.primary.main }}>
              {t('help.bilibili')}
            </a>
            <a href="https://www.youtube.com/@ducheese251" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '12px', color: theme.palette.primary.main }}>
              {t('help.youtube')}
            </a>
          </Typography>
        </Box>
      </DialogContent>

    </Dialog>
  );
};

export default HelpDialog;
