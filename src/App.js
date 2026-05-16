// Material UI
import React from 'react';
import { IconButton, CssBaseline } from '@mui/material';
import { ThemeProvider, alpha } from '@mui/material/styles';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

// 自定义组件
import MainLayout from './components/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import LangSwitcher from './components/LangSwitcher';

// Context
import { SnackbarProvider, useSnackbar } from './contexts/SnackbarContext';
import { ThemeSchemeProvider, useThemeScheme } from './contexts/ThemeSchemeContext';
import { SupportedExtensionsProvider } from './contexts/SupportedExtensionsContext';

// Utils
import { getTheme } from './utils/themeFactory';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

// ─────────────────────────────────────────────────────────────
// App 内容层（在所有 Provider 内部）
// ─────────────────────────────────────────────────────────────

function AppContent() {
  const { t, loadedLang } = useLanguage();
  const { darkMode, setDarkMode } = useThemeScheme();
  const showSnackbar = useSnackbar();

  // 仅初始加载时等待语言包
  if (!loadedLang) {
    return null;
  }

  return (
    <>
      {/* 右上角固定按钮组（语言切换 + 深浅色） */}
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
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Theme 层（需要 schemeId 和 darkMode）
// ─────────────────────────────────────────────────────────────

function AppWithTheme() {
  const { schemeId, darkMode } = useThemeScheme();
  const theme = getTheme(schemeId, darkMode ? 'dark' : 'light');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
        <AppContent />
      </SnackbarProvider>
    </ThemeProvider>
  );
}

// ─────────────────────────────────────────────────────────────
// App（根组件）
// ─────────────────────────────────────────────────────────────

function App() {
  return (
    <LanguageProvider>
      <SupportedExtensionsProvider>
        <ThemeSchemeProvider>
          <AppWithTheme />
        </ThemeSchemeProvider>
      </SupportedExtensionsProvider>
    </LanguageProvider>
  );
}

export default App;
