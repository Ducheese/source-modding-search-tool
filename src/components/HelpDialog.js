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
import { Close, Help, CheckCircle, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useSnackbar } from '../App';
import { useThemeScheme, COLOR_SCHEMES } from '../App';
import { tauriAPI } from '../utils/tauriBridge';
import { DEFAULT_AI_REGEX_PROMPT, DEFAULT_AI_CHAT_PROMPT, DEFAULT_AI_EXPLAIN_PROMPT, loadAiSettings, AI_SETTINGS_STORAGE_KEY } from '../utils/aiDefaults';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMarkdownStyles } from '../utils/markdownStyles';

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
            ? (t) => `${t.palette.primary.main}14`   // 8% tint
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
          {scheme.label}
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
const ReleaseEntry = ({ tag, name, body, date , markdownStyles, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
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

  const showSnackbar = useSnackbar();

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const { schemeId, setSchemeId } = useThemeScheme();

  const markdownStyles = useMemo(() => getMarkdownStyles(theme), [theme]);

  useEffect(() => {
    if (!open) return;
    setAiSettings(loadAiSettings());
  }, [open]);

  useEffect(() => {
    if (tabValue !== 4 || changelog !== null) return;
    setChangelog('loading');
    fetch('https://api.github.com/repos/Ducheese/source-modding-search-tool/releases')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) {
          const isRateLimit = data?.message?.toLowerCase().includes('rate limit');
          setChangelog(isRateLimit ? 'ratelimit' : 'error');
          return;
        }
        setChangelog(data.map(r => ({
          tag: r.tag_name,
          name: r.name || r.tag_name,
          body: (r.body || '（无说明）')
            .replace(/<img\b[^>]*>/gi, '')   // HTML img 标签（含 GitHub 的非自闭合形式）
            .trim(),
          date: r.published_at ? r.published_at.slice(0, 10) : null,  // 只取 yyyy-mm-dd
        })));
      })
      .catch(() => setChangelog('error'));
  }, [tabValue, changelog]);

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
      showSnackbar('请填写API Base Url、API Key和模型名称', 'warning');
      return;
    }

    setIsTesting(true);
    try {
      await tauriAPI.testAiConnection({
        user_prompt: '请只回复 OK',
        system_prompt: '你是一个测试助手。请直接回复用户请求的内容，不要添加任何额外信息。',
        api_key: aiSettings.apiKey,
        base_url: aiSettings.baseUrl,
        model_name: aiSettings.regexModelName || aiSettings.chatModelName || aiSettings.explainModelName,
      });
      showSnackbar('连接成功', 'success');
    } catch (error) {
      showSnackbar('连接超时', 'error');
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
            关于 &amp; 帮助
          </Typography>
          {/* 关闭按钮部分 */}
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* 介绍 / 说明 / 配置存储：选中大模型接入配置 Tab 时隐藏 */}
        {(tabValue !== 2 && tabValue !== 4) && <>
        {/* 介绍 */}
        <Box sx={{ mb: 3, px: 1, display: 'flex', alignItems: 'flex-start', gap: 3 }}>
          <Box
            component="img"
            src="/logos/ChatGPT Image 2026-03-12.png"
            alt="应用图标"
            sx={{ width: 72, height: 72, borderRadius: 2, flexShrink: 0, mt: 0.5 }}
          />
          <Typography>本工具旨在为 Valve Source 1 引擎（CS:S, CS:GO, L4D2, GMod等）的 Mod 开发者提供一个轻量、高性能的<b>跨文本检索</b>工具，因此支持提交和检索的文本文件格式只包括：.sp .cfg .ini .txt .vmt .qc .inc .lua .log .vdf .scr .res .nut。</Typography>
        </Box>

        {/* 说明 */}
        <Box sx={{ mb: 3, px: 1 }}>
          <Typography>食用方法是：在左上角“虚线框区域”完成文件提交，在左下角“文件列表区域”进行检查和初筛，在右上角“搜索配置区域”填上要检索的字符、正则或过滤通配符，在右下角“搜索结果区域”查看或导出结果，或把结果发给 AI 进行分析和讨论。</Typography>
        </Box>

        {/* 配置存储 */}
        <Box sx={{ mb: 2, px: 1 }}>
          <Typography>本工具的配置信息（含 API Key）会以明文存储在 <code>C:\Users\用户名\AppData\Local\com.sourcemodding.searchtool</code> 路径下，该路径同时包含 WebView2 运行时缓存。手动清空该路径可确保本工具的完全卸载，也可通过此方式解决新版本破坏性更新导致的各种稀奇古怪的Bug。</Typography>
        </Box>

        </>}

        {/* ── Tabs ── */}
        <Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
              <Tab label="路径过滤通配符" />
              <Tab label="正则使用建议" />
              <Tab label="大模型接入配置" />
              <Tab label="色彩方案" />
              <Tab label="更新日志" />
            </Tabs>
          </Box>

          {/* Tab 0 — 路径过滤通配符 */}
          <TabPanel value={tabValue} index={0}>
            <Typography component="div">
              本工具使用 Unix Shell 风格通配符进行路径筛选。它比正则表达式更简单，更专注于文件路径匹配。为简化输入，还有以下自动处理规则：
              <ul>
                <li>纯目录路径自动在两侧添加 <code>**</code> ，例如 <code>materials/models</code> 会被自动处理成 <code>**/materials/models/**</code></li>
                <li>纯后缀或文件名自动在前侧添加 <code>**</code> ，例如 <code>*.qc</code> 会被自动处理成 <code>**/*.qc</code></li>
                <li>字母大小写不敏感</li>
                <li><code>\</code> 和 <code>/</code> 均被视为路径分隔符，混用也能识别</li>
              </ul>
            </Typography>
          </TabPanel>

          {/* Tab 1 — 正则使用建议 */}
          <TabPanel value={tabValue} index={1}>
            <Typography component="div">
              本工具搜索结果的最小显示单位是行，也支持行首行尾的正则锚定，但站在程序后台的视角，整个文本文件并没有分行的概念，而是一个包含换行符的“单行文本”。因此有如下建议：
              <ul>
                <li>当你需要匹配行首、行尾的“空白”时，请养成使用 <code>[ \t]*</code> 代替 <code>\s*</code> 的习惯，避免跨行匹配导致显示错误</li>
                <li>字节正则引擎不支持断言（look around），如 <code>(?=...)</code>、<code>(?!...)</code>、<code>(?&lt;=...)</code>、<code>(?&lt;!...)</code> 等语法将无法正常工作</li>
              </ul>
            </Typography>
          </TabPanel>

          {/* Tab 2 — 大模型接入配置 */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* 说明文字 */}
              <Typography variant="body2" color="text.secondary">
                AI 写正则和 AI 解释正则需要模型的快速响应，不推荐使用参数量大、或固定开启思考的模型。
              </Typography>

              <TextField
                label="API Base Url"
                value={aiSettings.baseUrl}
                onChange={(e) => handleAiSettingChange('baseUrl', e.target.value)}
                placeholder="https://api.siliconflow.cn/v1"
                helperText="/v1 或 /v1/chat/completions 结尾均可"
                size="small"
                inputProps={{ style: { textOverflow: 'ellipsis' } }}
              />
              <TextField
                label="API Key"
                value={aiSettings.apiKey}
                onChange={(e) => handleAiSettingChange('apiKey', e.target.value)}
                type="password"
                placeholder="sk-xxx"
                helperText="注意，此 API Key 会在本地明文存储"
                size="small"
                inputProps={{ style: { textOverflow: 'ellipsis' } }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="用于 AI 写正则的模型"
                  value={aiSettings.regexModelName}
                  onChange={(e) => handleAiSettingChange('regexModelName', e.target.value)}
                  placeholder="Qwen/Qwen3-8B"
                  helperText="不启用思考，没有备用模型"
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{ style: { textOverflow: 'ellipsis' } }}
                />
                <TextField
                  label="用于 AI 对话的模型"
                  value={aiSettings.chatModelName}
                  onChange={(e) => handleAiSettingChange('chatModelName', e.target.value)}
                  placeholder="deepseek-ai/DeepSeek-V3.2"
                  helperText="支持显示思维链，留空则使用最左边模型"
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{ style: { textOverflow: 'ellipsis' } }}
                />
                <TextField
                  label="用于 AI 解释正则的模型"
                  value={aiSettings.explainModelName}
                  onChange={(e) => handleAiSettingChange('explainModelName', e.target.value)}
                  placeholder="Qwen/Qwen3-8B"
                  helperText="不启用思考，留空则使用最左边模型"
                  size="small"
                  sx={{ flex: 1 }}
                  inputProps={{ style: { textOverflow: 'ellipsis' } }}
                />
              </Box>
              <TextField
                label="AI 写正则的提示词"
                value={aiSettings.regexPrompt}
                onChange={(e) => handleAiSettingChange('regexPrompt', e.target.value)}
                helperText="注意，本工具所使用的正则引擎不支持断言（look around）"
                multiline
                minRows={6}
                maxRows={18}
              />
              <TextField
                label="AI 对话的提示词"
                value={aiSettings.chatPrompt}
                onChange={(e) => handleAiSettingChange('chatPrompt', e.target.value)}
                helperText="注意，必须提及{{context}}，才能把搜索结果挂载进上下文"
                multiline
                minRows={6}
                maxRows={18}
              />
              <TextField
                label="AI 解释正则的提示词"
                value={aiSettings.explainPrompt}
                onChange={(e) => handleAiSettingChange('explainPrompt', e.target.value)}
                helperText="建议输出简单文本，不支持换行符和富文本渲染"
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
                  重置所有提示词
                </Button>
                <Button
                  variant="contained"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </Button>
              </Box>
            </Box>
          </TabPanel>

          {/* Tab 3 — 外观设置（配色方案） */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

              {/* 说明文字 */}
              <Typography variant="body2" color="text.secondary">
                以下是符合 Material Design 2 规范的界面配色方案：
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
                      showSnackbar(`已切换到「${scheme.label}」配色`, 'success');
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
                  当前方案：{COLOR_SCHEMES[schemeId].label} — {COLOR_SCHEMES[schemeId].desc}
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
                GitHub API 请求次数已达上限，请稍后再试，或直接访问
                {' '}<a href="https://github.com/Ducheese/source-modding-search-tool/releases" target="_blank" rel="noopener noreferrer">Release 页面</a>
              </Alert>
            ) : changelog === 'error' ? (
              <Alert
                severity="warning"
                action={<Button size="small" onClick={() => setChangelog(null)}>重试</Button>}
              >
                加载失败，请检查网络连接
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {changelog.map(({ tag, name, body, date }, index) => (
                  <ReleaseEntry key={tag} tag={tag} name={name} body={body} date={date} markdownStyles={markdownStyles} defaultExpanded={index === 0} />
                ))}
              </Box>
            )}
          </TabPanel>

        </Box>

        {/* 超链接 */}
        <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="caption">
            <a href="https://github.com/Ducheese/source-modding-search-tool" target="_blank" rel="noopener noreferrer" >
              Github仓库
            </a>
            <a href="https://space.bilibili.com/1889622121" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px' }}>
              B站主页
            </a>
          </Typography>
        </Box>
      </DialogContent>

    </Dialog>
  );
};

export default HelpDialog;
