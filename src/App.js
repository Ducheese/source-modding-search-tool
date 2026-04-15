// Material UI组件库
import React, { useState, useEffect, useCallback } from 'react';
import {
  IconButton,
  Snackbar,
  Alert,
  Slide,
} from '@mui/material';
import { ThemeProvider, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

// 自定义组件
import MainLayout from './components/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import LangSwitcher from './components/LangSwitcher';

// 配置
import { COLOR_SCHEMES } from './config/colorSchemes';
import { COLOR_SCHEME_STORAGE_KEY } from './config/storageKeys';

// Context
import { SnackbarProvider } from './contexts/SnackbarContext';
import { ThemeSchemeProvider } from './contexts/ThemeSchemeContext';

// Utils
import { getTheme } from './utils/themeFactory';
import { LanguageProvider, useLanguage } from './utils/i18n';

// ─────────────────────────────────────────────────────────────
// App 内层（已能访问 ThemeProvider 和 SnackbarContext）
// ─────────────────────────────────────────────────────────────

function AppInner({ darkMode, setDarkMode, schemeId, handleSetScheme }) {
  const { t, loadedLang } = useLanguage();

  const [activeSnackbar, setActiveSnackbar] = useState([]);

  const showSnackbar = useCallback((message, severity = 'info') => {
    const id = Date.now();
    setActiveSnackbar([{ id, message, severity }]);
  }, []);

  const closeSnackbar = (id) => {
    setActiveSnackbar(prev => prev.filter(item => item.id !== id));
  };

  const theme = getTheme(schemeId, darkMode ? 'dark' : 'light');

  // 仅初始加载时等待（loadedLang 初始为 null）
  // 切换语言时 loadedLang 不重置，旧语言继续显示，无 loading
  if (!loadedLang) {
    return null;
  }

  return (
    <ThemeSchemeProvider value={{ schemeId, setSchemeId: handleSetScheme }}>
      <SnackbarProvider value={showSnackbar}>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          {/* 右上角固定按钮组（语言切换 + 深浅色，zIndex 1301） */}
          <div
            style={{
              position: 'fixed',
              top: 22,
              right: 22,
              zIndex: 1301,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {/* 语言切换下拉 */}
            <LangSwitcher />

            {/* 深浅色模式切换 */}
            <IconButton
              color="inherit"
              onClick={() => {
                const newMode = !darkMode;
                setDarkMode(newMode);
                showSnackbar(
                  newMode ? t('app.switchToDark') : t('app.switchToLight'),
                  'info'
                );
              }}
              sx={{
                bgcolor: 'background.paper',
                boxShadow: 2,
                '&:hover': {
                  boxShadow: 4,
                  bgcolor: (theme) => alpha(theme.palette.background.paper, 0.8),
                },
              }}
            >
              {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </div>

          <ErrorBoundary>
            <MainLayout />
          </ErrorBoundary>

          {/* Snackbar 消息 */}
          {activeSnackbar.map((item) => (
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
                sx={{ minWidth: '200px' }}
              >
                {item.message}
              </Alert>
            </Snackbar>
          ))}

        </ThemeProvider>
      </SnackbarProvider>
    </ThemeSchemeProvider>
  );
}

// ─────────────────────────────────────────────────────────────
// App（根组件）
// ─────────────────────────────────────────────────────────────

function App() {
  // 深浅色模式：默认跟随系统
  const [darkMode, setDarkMode] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setDarkMode(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // body class 同步（供 index.css 感知深浅色）
  useEffect(() => {
    document.body.classList.toggle('dark-theme', darkMode);
  }, [darkMode]);

  // 配色方案
  const [schemeId, setSchemeId] = useState(() => {
    const saved = parseInt(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY), 10);
    return Number.isFinite(saved) && saved >= 0 && saved < COLOR_SCHEMES.length ? saved : 0;
  });

  const handleSetScheme = (id) => {
    setSchemeId(id);
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, String(id));
  };

  return (
    <LanguageProvider>
      <AppInner
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        schemeId={schemeId}
        handleSetScheme={handleSetScheme}
      />
    </LanguageProvider>
  );
}

export default App;
