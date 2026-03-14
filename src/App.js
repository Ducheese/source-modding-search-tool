// Material UI组件库
import React, { useState, useEffect, createContext, useContext } from 'react';
import { IconButton, Snackbar, Alert, Slide } from '@mui/material';
import { ThemeProvider, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

// 自定义组件
import MainLayout from './components/MainLayout';
import { COLOR_SCHEME_STORAGE_KEY, THEMES } from './utils/themeConfig';

// ─────────────────────────────────────────────────────────────
// 色彩方案导入
// ─────────────────────────────────────────────────────────────

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
          <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 1301 }}>
            <IconButton
              // size="medium"  // 默认就是 medium
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