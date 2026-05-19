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
  Fade,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import { Close, Help, CheckCircle, ExpandMore, ExpandLess, NewReleases, Feedback } from '@mui/icons-material';
import { tauriAPI } from '../utils/tauriBridge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { homeDir } from '@tauri-apps/api/path';

import { useSnackbar } from '../contexts/SnackbarContext';
import { useThemeScheme } from '../contexts/ThemeSchemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSupportedExtensions } from '../contexts/SupportedExtensionsContext';
import { formatSupportedExtensions } from '../config/supportedFiles';
import { COLOR_SCHEMES } from '../config/colorSchemes';
import { getMarkdownStyles } from '../utils/markdownStyles';
import { useAiSettings } from '../hooks/useAiSettings';
import { useChangelog } from '../hooks/useChangelog';
import FeedbackForm from './FeedbackForm';
import SupportedExtensionsEditor from './SupportedExtensionsEditor';

// ─────────────────────────────────────────────────────────────
// TabPanel
// ─────────────────────────────────────────────────────────────
const TabPanel = (props) => {
  const { children, value, index, disableFade = false, ...other } = props;
  const isActive = value === index;
  return (
    <div hidden={!isActive} {...other}>
      {disableFade ? (
        isActive && (
          <Box sx={{ py: 2, px: 1 }}>
            <Typography component="div">{children}</Typography>
          </Box>
        )
      ) : (
        <Fade in={isActive} timeout={260} mountOnEnter unmountOnExit>
          <Box sx={{ py: 2, px: 1 }}>
            <Typography component="div">{children}</Typography>
          </Box>
        </Fade>
      )}
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
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: primary,
              boxShadow: `0 2px 6px ${primary}88`,
              border: '2px solid rgba(255,255,255,0.25)',
            }}
          />
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

        <Typography
          variant="caption"
          fontWeight={selected ? 700 : 400}
          sx={{ color: selected ? 'primary.main' : 'text.secondary', lineHeight: 1.2, textAlign: 'center' }}
        >
          {t(scheme.labelKey)}
        </Typography>

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
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{date}</Typography>
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
  const [configPath, setConfigPath] = useState(null);

  const showSnackbar = useSnackbar();
  const { t, lang } = useLanguage();
  const { extensions } = useSupportedExtensions();

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { schemeId, setSchemeId } = useThemeScheme();
  const markdownStyles = useMemo(() => getMarkdownStyles(theme), [theme]);

  // 使用 hooks
  const { settings: aiSettings, setField: setAiSetting, resetPrompts, testConnection, isTesting } = useAiSettings({ lang, open, showSnackbar, t });
  const { releases, currentVersion, hasUpdate, isLoading, isError, isRateLimited, load: loadChangelog } = useChangelog({ open, t });

  const handleTabChange = (_, newValue) => setTabValue(newValue);

  // 获取配置文件路径
  useEffect(() => {
    if (!open || configPath !== null) return;
    homeDir()
      .then(home => {
        if (home) {
          const path = `${home}\\AppData\\Local\\com.sourcemodding.searchtool`;
          setConfigPath(path);
        }
      })
      .catch((err) => {
        console.error('Failed to find config folder:', err);
      });
  }, [open, configPath]);

  const handleTestConnection = () => testConnection();

  return (
    <Dialog open={open} onClose={() => {
      if (document.activeElement) {
        document.activeElement.blur();
      }
      onClose();
    }} maxWidth="md" fullWidth>

      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="h1" fontWeight="700" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Help sx={{ color: 'primary.main' }} />
            {t('help.title')}
          </Typography>
          <IconButton onClick={() => {
            if (document.activeElement) {
              document.activeElement.blur();
            }
            onClose();
          }}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* 介绍 / 说明 / 配置存储 */}
        {(tabValue !== 2 && tabValue !== 3 && tabValue !== 4 && tabValue !== 5) && <>
        <Box sx={{ mb: 3, px: 1, display: 'flex', alignItems: 'flex-start', gap: 3 }}>
          <Box
            component="img"
            src="/logos/ChatGPT Image 2026-03-12.png"
            alt={t('help.appIconAlt')}
            sx={{ width: 72, height: 72, borderRadius: 2, flexShrink: 0, mt: 0.5 }}
          />
          <Typography component="div">
            <Box component="span" dangerouslySetInnerHTML={{ __html: t('help.intro', { extensions: formatSupportedExtensions(extensions) }) }} />
            <SupportedExtensionsEditor />
          </Typography>
        </Box>

        <Box sx={{ mb: 3, px: 1 }}>
          <Typography>{t('help.usage')}</Typography>
        </Box>

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

        {/* Tabs */}
        <Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
              <Tab label={t('help.tab.pathFilter')} sx={{ whiteSpace: 'normal', maxWidth: 180 }}/>
              <Tab label={t('help.tab.regex')} sx={{ whiteSpace: 'normal', maxWidth: 180 }}/>
              <Tab label={t('help.tab.aiConfig')} sx={{ whiteSpace: 'normal', maxWidth: 180 }}/>
              <Tab label={t('help.tab.colorScheme')} sx={{ whiteSpace: 'normal', maxWidth: 180 }}/>
              <Tab label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {t('help.tab.changelog')}
                  {hasUpdate && <NewReleases sx={{ fontSize: 16, color: 'error.main' }} />}
                </Box>
              } sx={{ whiteSpace: 'normal', maxWidth: 180 }}/>
              <Tab label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Feedback sx={{ fontSize: 16 }} />
                  Feedback
                </Box>
              } sx={{ whiteSpace: 'normal', maxWidth: 180 }}/>
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
                <li dangerouslySetInnerHTML={{ __html: t('help.regex.rule3') }} />
              </ul>
            </Typography>
          </TabPanel>

          {/* Tab 2 — 大模型接入配置 */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              <Typography variant="body2" color="text.secondary">
                {t('help.aiConfig.desc')}
              </Typography>

              <TextField
                label="API Base Url"
                value={aiSettings.baseUrl}
                onChange={(e) => setAiSetting('baseUrl', e.target.value)}
                placeholder="https://openrouter.ai/api/v1"
                helperText={t('help.apiBaseUrlHelper')}
                size="small"
                inputProps={{ style: { textOverflow: 'ellipsis' } }}
              />
              <TextField
                label="API Key"
                value={aiSettings.apiKey}
                onChange={(e) => setAiSetting('apiKey', e.target.value)}
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
                  onChange={(e) => setAiSetting('regexModelName', e.target.value)}
                  placeholder="qwen/qwen3.5-9b"
                  helperText={t('help.regexModelHelper')}
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{ style: { textOverflow: 'ellipsis' } }}
                />
                <TextField
                  label={t('help.chatModel')}
                  value={aiSettings.chatModelName}
                  onChange={(e) => setAiSetting('chatModelName', e.target.value)}
                  placeholder="deepseek/deepseek-v3.2"
                  helperText={t('help.chatModelHelper')}
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{ style: { textOverflow: 'ellipsis' } }}
                />
                <TextField
                  label={t('help.explainModel')}
                  value={aiSettings.explainModelName}
                  onChange={(e) => setAiSetting('explainModelName', e.target.value)}
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
                onChange={(e) => setAiSetting('regexPrompt', e.target.value)}
                helperText={t('help.regexPromptHelper')}
                multiline
                minRows={6}
                maxRows={18}
              />
              <TextField
                label={t('help.chatPromptLabel')}
                value={aiSettings.chatPrompt}
                onChange={(e) => setAiSetting('chatPrompt', e.target.value)}
                helperText={t('help.chatPromptHelper')}
                multiline
                minRows={6}
                maxRows={18}
              />
              <TextField
                label={t('help.explainPromptLabel')}
                value={aiSettings.explainPrompt}
                onChange={(e) => setAiSetting('explainPrompt', e.target.value)}
                helperText={t('help.explainPromptHelper')}
                multiline
                minRows={6}
                maxRows={18}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button variant="outlined" onClick={resetPrompts}>
                  {t('help.resetPrompts')}
                </Button>
                <Button variant="contained" onClick={handleTestConnection} disabled={isTesting}>
                  {isTesting ? t('help.testing') : t('help.testConnection')}
                </Button>
              </Box>
            </Box>
          </TabPanel>

          {/* Tab 3 — 配色方案 */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

              <Typography variant="body2" color="text.secondary">
                {t('help.colorScheme.desc')}
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
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

              <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  {t('help.colorScheme.current', { label: t(COLOR_SCHEMES[schemeId].labelKey), desc: COLOR_SCHEMES[schemeId].desc })}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Primary', color: theme.palette.primary.main },
                    { label: 'Pri. Dark', color: theme.palette.primary.dark },
                    { label: 'Secondary', color: theme.palette.secondary.main },
                    { label: 'Sec. Dark', color: theme.palette.secondary.dark },
                    { label: 'Background', color: theme.palette.background.default },
                    { label: 'Surface', color: theme.palette.background.paper },
                    { label: 'Error', color: theme.palette.error.main },
                  ].map(({ label, color }) => (
                    <Tooltip title={color} arrow key={label}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, width: 56 }}>
                        <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: color, border: `1px solid ${theme.palette.divider}`, boxShadow: 1 }} />
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{label}</Typography>
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              </Box>

            </Box>
          </TabPanel>

          {/* Tab 4 — 更新日志 */}
          <TabPanel value={tabValue} index={4}>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : isRateLimited ? (
              <Alert severity="info" action={<Button size="small" onClick={loadChangelog}>{t('help.changelog.retry')}</Button>}>
                {t('help.changelog.rateLimit')}
                {' '}<a href="https://github.com/Ducheese/source-modding-search-tool/releases" target="_blank" rel="noopener noreferrer">{t('help.changelog.rateLimitLink')}</a>
              </Alert>
            ) : isError ? (
              <Alert severity="warning" action={<Button size="small" onClick={loadChangelog}>{t('help.changelog.retry')}</Button>}>
                {t('help.changelog.error')}
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {releases.map(({ tag, name, body, date }, index) => (
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

          {/* Tab 5 — 翻译反馈 (Feedback 继续用它自己内部现有的表单渐变，disableFade 避免双重叠加动画) */}
          <TabPanel value={tabValue} index={5} disableFade>
            <FeedbackForm />
          </TabPanel>

        </Box>

        {/* 超链接 */}
        <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="caption">
            <a href="https://github.com/Ducheese/source-modding-search-tool" target="_blank" rel="noopener noreferrer" style={{ color: theme.palette.primary.main }}>
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
