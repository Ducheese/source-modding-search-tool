import React from 'react';
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
} from '@mui/material';
import { Close, Help } from '@mui/icons-material';
import { useSnackbar } from '../App';
import { tauriAPI } from '../utils/tauriBridge';
import { DEFAULT_AI_REGEX_PROMPT, DEFAULT_AI_CHAT_PROMPT, DEFAULT_AI_EXPLAIN_PROMPT, loadAiSettings, AI_SETTINGS_STORAGE_KEY } from '../utils/aiDefaults';

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2, px: 1 }}><Typography component="div">{children}</Typography></Box>}
    </div>
  );
};

const HelpDialog = ({ open, onClose }) => {
  const [tabValue, setTabValue] = React.useState(0);
  const [aiSettings, setAiSettings] = React.useState(loadAiSettings());
  const [isTesting, setIsTesting] = React.useState(false);
  const handleTabChange = (event, newValue) => setTabValue(newValue);

  const showSnackbar = useSnackbar();

  React.useEffect(() => {
    if (!open) return;
    setAiSettings(loadAiSettings());
  }, [open]);

  const handleAiSettingChange = (field, value) => {
    setAiSettings(prev => {
      const next = { ...prev, [field]: value };
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleTestConnection = async () => {
    if (!aiSettings.baseUrl.trim() || !aiSettings.apiKey.trim() || !aiSettings.modelName.trim()) {
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
        model_name: aiSettings.modelName,
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
            关于 & 帮助
          </Typography>
          {/* 关闭按钮部分 */}
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* 介绍 */}
        <Box sx={{ mb: 3, px: 1 }}>
          <Typography variant="h6" gutterBottom>这是什么</Typography>
          <Typography>本工具旨在为 Valve Source 1 引擎（CS:S, CS:GO, L4D2, GMod等）的 Mod 开发者提供一个轻量、高性能的<b>跨文本</b>检索工具，因此支持提交和检索的文本文件格式只包括：.sp .cfg .ini .txt .vmt .qc .inc .lua .log .vdf .scr .res .nut。</Typography>
        </Box>

        {/* 说明 */}
        <Box sx={{ mb: 2, px: 1 }}>
          <Typography variant="h6" gutterBottom>如何使用</Typography>
          <Typography>在左上角“虚线框区域”完成文件提交，在左下角“文件列表区域”进行检查和初筛，在右上角“搜索配置区域”填上要检索的字符、正则或过滤通配符，在右下角“搜索结果区域”查看或导出结果。</Typography>
        </Box>

        {/* 关于高级选项 */}
        <Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="路径过滤通配符" />
              <Tab label="正则使用建议" />
              <Tab label="大模型接入配置" />
            </Tabs>
          </Box>

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

          <TabPanel value={tabValue} index={1}>
            <Typography component="div">
              本工具搜索结果的最小显示单位是行，也支持行首行尾的正则锚定，但站在程序后台的视角，整个文本文件并没有分行的概念，而是一个包含换行符的“单行文本”。因此有如下建议：
              <ul>
                <li>当你需要匹配行首、行尾的“空白”时，请养成使用 <code>[ \t]*</code> 代替 <code>\s*</code> 的习惯，避免跨行匹配导致显示错误</li>
                <li>字节正则引擎不支持断言（look around），如 <code>(?=...)</code>、<code>(?!...)</code>、<code>(?&lt;=...)</code>、<code>(?&lt;!...)</code> 等语法将无法正常工作</li>
              </ul>
            </Typography>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="API Base Url"
                value={aiSettings.baseUrl}
                onChange={(e) => handleAiSettingChange('baseUrl', e.target.value)}
                placeholder="https://api.siliconflow.cn/v1"
                size="small"
              />
              <TextField
                label="API Key"
                value={aiSettings.apiKey}
                onChange={(e) => handleAiSettingChange('apiKey', e.target.value)}
                type="password"
                placeholder="sk-xxx"
                size="small"
              />
              <TextField
                label="模型名称"
                value={aiSettings.modelName}
                onChange={(e) => handleAiSettingChange('modelName', e.target.value)}
                placeholder="Qwen/Qwen3-8B"
                size="small"
              />
              <TextField
                label="AI 写正则的提示词"
                value={aiSettings.regexPrompt}
                onChange={(e) => handleAiSettingChange('regexPrompt', e.target.value)}
                placeholder="注意，本工具所使用的正则引擎不支持断言（look around）"
                multiline
                minRows={6}
                maxRows={18}
              />
              <TextField
                label="AI 对话的提示词"
                value={aiSettings.chatPrompt}
                onChange={(e) => handleAiSettingChange('chatPrompt', e.target.value)}
                placeholder="用{{context}}表示搜索结果"
                multiline
                minRows={6}
                maxRows={18}
              />
              <TextField
                label="AI 解释正则的提示词"
                value={aiSettings.explainPrompt}
                onChange={(e) => handleAiSettingChange('explainPrompt', e.target.value)}
                placeholder="建议输出简单文本，不支持换行符和富文本渲染"
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
