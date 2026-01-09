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
} from '@mui/material';
import { Close } from '@mui/icons-material';

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
  const handleTabChange = (event, newValue) => setTabValue(newValue);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>

      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          {/* 标题部分 */}
          <Typography variant="h6" component="h1" fontWeight="bold">
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
          <Typography>本工具旨在为 Valve Source 1 引擎（CS:S, CS:GO, L4D2, GMod等）的 Mod 开发者提供一个轻量、高性能的<b>跨文本</b>检索工具，因此支持提交和检索的文本文件格式只包括：.sp .cfg .ini .txt .vmt .qc .inc .lua .log .vdf .scr .res。</Typography>
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
              </ul>
            </Typography>
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