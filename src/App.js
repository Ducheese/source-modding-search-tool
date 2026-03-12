// Material UI组件库
import React, { useState, useEffect, createContext, useContext } from 'react';
import { IconButton, Snackbar, Alert, Slide } from '@mui/material';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

// 自定义组件
import MainLayout from './components/MainLayout';

// ─────────────────────────────────────────────────────────────
// 配色方案定义（符合 Google Material Design 2 规范）
// ─────────────────────────────────────────────────────────────

const COLOR_SCHEME_STORAGE_KEY = 'colorScheme';

// ── 方案 0：经典紫（MD2 Deep Purple 500 / Teal 200）──────────
const scheme0Light = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#6200EE', dark: '#3700B3', contrastText: '#FFFFFF' },
    secondary:  { main: '#03DAC6', dark: '#018786', contrastText: '#000000' },
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
    error:      { main: '#B00020', contrastText: '#FFFFFF' },
    text:       { primary: 'rgba(0,0,0,0.87)', secondary: 'rgba(0,0,0,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

const scheme0Dark = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#BB86FC', dark: '#3700B3', contrastText: '#000000' },
    secondary:  { main: '#03DAC6', contrastText: '#000000' },
    background: { default: '#121212', paper: '#1E1E1E' },
    error:      { main: '#CF6679', contrastText: '#000000' },
    text:       { primary: 'rgba(255,255,255,0.87)', secondary: 'rgba(255,255,255,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12, backgroundColor: '#1E1E1E' } } },
  },
});

// ── 方案 1：落樱粉 (Pink 400 / Cyan 400) ────────────
const scheme1Light = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#EC407A', dark: '#AD1457', contrastText: '#FFFFFF' },
    secondary:  { main: '#26C6DA', dark: '#0097A7', contrastText: '#000000' },
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
    error:      { main: '#B00020', contrastText: '#FFFFFF' },
    text:       { primary: 'rgba(0,0,0,0.87)', secondary: 'rgba(0,0,0,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

const scheme1Dark = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#F48FB1', dark: '#C2185B', contrastText: '#000000' }, 
    secondary:  { main: '#80DEEA', dark: '#00ACC1', contrastText: '#000000' },
    background: { default: '#121212', paper: '#1E1E1E' },
    error:      { main: '#CF6679', contrastText: '#000000' },
    text:       { primary: 'rgba(255,255,255,0.87)', secondary: 'rgba(255,255,255,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12, backgroundColor: '#1E1E1E' } } },
  },
});

// ── 方案 2：水鸭青 (Teal 500 / Deep Orange 500) ────────────
const scheme2Light = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#009688', dark: '#00796B', contrastText: '#FFFFFF' },
    secondary:  { main: '#FF5722', dark: '#E64A19', contrastText: '#FFFFFF' },
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
    error:      { main: '#B00020', contrastText: '#FFFFFF' },
    text:       { primary: 'rgba(0,0,0,0.87)', secondary: 'rgba(0,0,0,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

const scheme2Dark = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#80CBC4', dark: '#4DB6AC', contrastText: '#000000' }, // Teal 200
    secondary:  { main: '#FFAB91', dark: '#FF8A65', contrastText: '#000000' }, // Deep Orange 200
    background: { default: '#121212', paper: '#1E1E1E' },
    error:      { main: '#CF6679', contrastText: '#000000' },
    text:       { primary: 'rgba(255,255,255,0.87)', secondary: 'rgba(255,255,255,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12, backgroundColor: '#1E1E1E' } } },
  },
});

// ── 方案 3：寒烟绯（Blue Grey 500 / Red 500） ────────────
const scheme3Light = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#607D8B', dark: '#455A64', contrastText: '#FFFFFF' },
    secondary:  { main: '#F44336', dark: '#D32F2F', contrastText: '#FFFFFF' },
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
    error:      { main: '#B00020', contrastText: '#FFFFFF' },
    text:       { primary: 'rgba(0,0,0,0.87)', secondary: 'rgba(0,0,0,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

const scheme3Dark = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#B0BEC5', dark: '#78909C', contrastText: '#000000' }, // Blue Grey 200
    secondary:  { main: '#EF9A9A', dark: '#E57373', contrastText: '#000000' }, // Red 200
    background: { default: '#121212', paper: '#1E1E1E' },
    error:      { main: '#CF6679', contrastText: '#000000' },
    text:       { primary: 'rgba(255,255,255,0.87)', secondary: 'rgba(255,255,255,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12, backgroundColor: '#1E1E1E' } } },
  },
});

// ── 方案 4：古木翠（Brown 500 / Light Green 500）───────
const scheme4Light = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#795548', dark: '#5D4037', contrastText: '#FFFFFF' },
    secondary:  { main: '#8BC34A', dark: '#689F38', contrastText: '#000000' },
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
    error:      { main: '#B00020', contrastText: '#FFFFFF' },
    text:       { primary: 'rgba(0,0,0,0.87)', secondary: 'rgba(0,0,0,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

const scheme4Dark = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#BCAAA4', dark: '#8D6E63', contrastText: '#000000' }, // Brown 200
    secondary:  { main: '#AED581', dark: '#9CCC65', contrastText: '#000000' }, // Light Green 200
    background: { default: '#121212', paper: '#1E1E1E' },
    error:      { main: '#CF6679', contrastText: '#000000' },
    text:       { primary: 'rgba(255,255,255,0.87)', secondary: 'rgba(255,255,255,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12, backgroundColor: '#1E1E1E' } } },
  },
});

// ── 方案 5：靛蓝橙 (Indigo 500 / Orange 500) ─────────
const scheme5Light = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#3F51B5', dark: '#303F9F', contrastText: '#FFFFFF' },
    secondary:  { main: '#FF9800', dark: '#F57C00', contrastText: '#000000' },
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
    error:      { main: '#B00020', contrastText: '#FFFFFF' },
    text:       { primary: 'rgba(0,0,0,0.87)', secondary: 'rgba(0,0,0,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

const scheme5Dark = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#9FA8DA', dark: '#7986CB', contrastText: '#000000' }, 
    secondary:  { main: '#FFCC80', dark: '#FFB74D', contrastText: '#000000' },
    background: { default: '#121212', paper: '#1E1E1E' },
    error:      { main: '#CF6679', contrastText: '#000000' },
    text:       { primary: 'rgba(255,255,255,0.87)', secondary: 'rgba(255,255,255,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12, backgroundColor: '#1E1E1E' } } },
  },
});

// ── 方案 6：藤萝紫（Green 600 / Deep Purple 400）反向撞色 ───
const scheme6Light = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#43A047', dark: '#2E7D32', contrastText: '#FFFFFF' },
    secondary:  { main: '#7E57C2', dark: '#512DA8', contrastText: '#FFFFFF' },
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
    error:      { main: '#B00020', contrastText: '#FFFFFF' },
    text:       { primary: 'rgba(0,0,0,0.87)', secondary: 'rgba(0,0,0,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

const scheme6Dark = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#81C784', dark: '#66BB6A', contrastText: '#000000' }, // Green 300 (MD2标准暗色偏好)
    secondary:  { main: '#B39DDB', dark: '#9575CD', contrastText: '#000000' }, // Deep Purple 200
    background: { default: '#121212', paper: '#1E1E1E' },
    error:      { main: '#CF6679', contrastText: '#000000' },
    text:       { primary: 'rgba(255,255,255,0.87)', secondary: 'rgba(255,255,255,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12, backgroundColor: '#1E1E1E' } } },
  },
});

// ── 方案 7：苍海珀（Cyan 700 / Amber 500）深沉冷色 ─────────
const scheme7Light = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#0097A7', dark: '#006064', contrastText: '#FFFFFF' },
    secondary:  { main: '#FFC107', dark: '#FFA000', contrastText: '#000000' },
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
    error:      { main: '#B00020', contrastText: '#FFFFFF' },
    text:       { primary: 'rgba(0,0,0,0.87)', secondary: 'rgba(0,0,0,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12 } } },
  },
});

const scheme7Dark = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#80DEEA', dark: '#4DD0E1', contrastText: '#000000' }, // Cyan 200
    secondary:  { main: '#FFE082', dark: '#FFD54F', contrastText: '#000000' }, // Amber 200
    background: { default: '#121212', paper: '#1E1E1E' },
    error:      { main: '#CF6679', contrastText: '#000000' },
    text:       { primary: 'rgba(255,255,255,0.87)', secondary: 'rgba(255,255,255,0.6)' },
  },
  typography: { fontFamily: '"Roboto","Helvetica","Arial","Noto Sans SC",sans-serif' },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
    MuiPaper:  { styleOverrides: { root: { borderRadius: 12, backgroundColor: '#1E1E1E' } } },
  },
});

// ─────────────────────────────────────────────────────────────
// 配色元数据（供 HelpDialog 渲染选择器）
// ─────────────────────────────────────────────────────────────

export const COLOR_SCHEMES = [
  {
    id: 0,
    label: '经典紫',
    desc: 'Deep Purple 500 / Teal 200',
    lightPrimary:  '#6200EE',
    lightSecondary:'#03DAC6',
    darkPrimary:   '#BB86FC',
    darkSecondary: '#03DAC6',
  },
  {
    id: 1,
    label: '落樱粉',
    desc: 'Pink 400 / Cyan 400',
    lightPrimary:  '#EC407A',
    lightSecondary:'#26C6DA',
    darkPrimary:   '#F48FB1',
    darkSecondary: '#80DEEA',
  },
  {
    id: 2,
    label: '水鸭青',
    desc: 'Teal 500 / Deep Orange 500',
    lightPrimary:  '#009688',
    lightSecondary:'#FF5722',
    darkPrimary:   '#80CBC4',
    darkSecondary: '#FFAB91',
  },
  {
    id: 3,
    label: '寒烟绯',
    desc: 'Blue Grey 500 / Red 500',
    lightPrimary:  '#607D8B',
    lightSecondary:'#F44336',
    darkPrimary:   '#B0BEC5',
    darkSecondary: '#EF9A9A',
  },
  {
    id: 4,
    label: '古木翠',
    desc: 'Brown 500 / Light Green 500',
    lightPrimary:  '#795548',
    lightSecondary:'#8BC34A',
    darkPrimary:   '#BCAAA4',
    darkSecondary: '#AED581',
  },
  {
    id: 5,
    label: '宵靛金',
    desc: 'Indigo 500 / Orange 500',
    lightPrimary:  '#3F51B5',
    lightSecondary:'#FF9800',
    darkPrimary:   '#9FA8DA',
    darkSecondary: '#FFCC80',
  },
  {
    id: 6,
    label: '藤萝紫',
    desc: 'Green 600 / Deep Purple 400',
    lightPrimary:  '#43A047',
    lightSecondary:'#7E57C2',
    darkPrimary:   '#81C784',
    darkSecondary: '#B39DDB',
  },
  {
    id: 7,
    label: '苍海珀',
    desc: 'Cyan 700 / Amber 500',
    lightPrimary:  '#0097A7',
    lightSecondary:'#FFC107',
    darkPrimary:   '#80DEEA',
    darkSecondary: '#FFE082',
  },
];

// 方案主题表
const THEMES = [
  [scheme0Light, scheme0Dark],
  [scheme1Light, scheme1Dark],
  [scheme2Light, scheme2Dark],
  [scheme3Light, scheme3Dark],
  [scheme4Light, scheme4Dark],
  [scheme5Light, scheme5Dark],
  [scheme6Light, scheme6Dark],
  [scheme7Light, scheme7Dark],
];

// 主题配色方案
export const ThemeSchemeContext = createContext();
export const useThemeScheme = () => useContext(ThemeSchemeContext);

// ─────────────────────────────────────────────────────────────
// 色彩方案之外
// ─────────────────────────────────────────────────────────────

// Snackbar信息提示
const SnackbarContext = createContext();
export const useSnackbar = () => useContext(SnackbarContext);

// index.js引入了App
function App() {
  {/* 深浅色模式 */}

  // 深浅色默认跟随系统主题
  const [darkMode, setDarkMode] = useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 监听 darkMode 的变化，去改变 body 的 class，这样index.css就能感受到深浅色模式的变化
  useEffect(() => {
    const body = document.body;
    if (darkMode) {
      body.classList.add('dark-theme');
    } else {
      body.classList.remove('dark-theme');
    }
  }, [darkMode]);

  {/* 配色方案切换 */}
  const [schemeId, setSchemeId] = useState(() => {
    const saved = parseInt(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY), 10);
    return Number.isFinite(saved) && saved >= 0 && saved < THEMES.length ? saved : 0;
  });

  const handleSetScheme = (id) => {
    setSchemeId(id);
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, String(id));
  };

  {/* 色彩方案移到App外，防止重复创建 */}

  const theme = THEMES[schemeId][darkMode ? 1 : 0];
  
  {/* Snackbar Context */}

  // Snackbar 消息队列
  const [snackbarQueue, setSnackbarQueue] = useState([]);

  // 显示 Snackbar 消息
  const showSnackbar = (message, severity = 'info') => {
    const id = Date.now();
    setSnackbarQueue([{ id, message, severity }]);
  };

  // 关闭 Snackbar 消息
  const closeSnackbar = (id) => {
    setSnackbarQueue(prev => prev.filter(item => item.id !== id));
  };

  return (
    <ThemeSchemeContext.Provider value={{ schemeId, setSchemeId: handleSetScheme }}>
      <SnackbarContext.Provider value={showSnackbar}>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          {/* 深浅色模式切换按钮，纵深次序1301 */}
          <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1301 }}>
            <IconButton
              color="inherit"
              onClick={() => {
                const newMode = !darkMode;
                setDarkMode(newMode);
                showSnackbar(`已切换到${newMode ? '深色' : '浅色'}模式`, 'info');
              }}
              sx={{
                bgcolor: 'background.paper',
                boxShadow: 2,   // 添加阴影效果
                '&:hover': {
                  boxShadow: 4, // 悬停时增加阴影
                  bgcolor: (theme) => alpha(theme.palette.background.paper, 0.8),
                },
              }}
            >
              {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </div>

          <MainLayout />

          {/* Snackbar 消息 */}
          {snackbarQueue.map((item) => (
            <Snackbar
              key={item.id}
              open={true}
              autoHideDuration={2000}
              onClose={() => closeSnackbar(item.id)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              TransitionComponent={Slide}
              TransitionProps={{ direction: 'up' }}
            >
              <Alert
                onClose={() => closeSnackbar(item.id)}
                severity={item.severity}
                sx={{ minWidth: '200px' }}   // 设置更小的最小宽度
              >
                {item.message}
              </Alert>
            </Snackbar>
          ))}

        </ThemeProvider>
      </SnackbarContext.Provider>
    </ThemeSchemeContext.Provider>
  );
}
export default App;