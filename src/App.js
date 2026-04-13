// Material UI组件库
import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  IconButton,
  Snackbar,
  Alert,
  Slide,
  Menu,
  MenuItem,
} from '@mui/material';
import { ThemeProvider, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LanguageIcon from '@mui/icons-material/Language';

// 自定义组件
import MainLayout from './components/MainLayout';
import { COLOR_SCHEME_STORAGE_KEY, getTheme, COLOR_SCHEMES } from './utils/themeConfig';
import { LanguageProvider, useLanguage } from './utils/i18n';

// ─────────────────────────────────────────────────────────────
// Error Boundary（捕获渲染错误，防止白屏）
// ─────────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '20px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <h1 style={{ marginBottom: '16px', color: '#d32f2f' }}>出错了</h1>
          <p style={{ marginBottom: '24px', color: '#666' }}>
            应用遇到了一个错误。请尝试刷新页面。
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              fontSize: '16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            刷新页面
          </button>
          <details style={{ marginTop: '24px', maxWidth: '600px', overflow: 'auto' }}>
            <summary style={{ cursor: 'pointer', color: '#999' }}>错误详情</summary>
            <pre style={{ marginTop: '8px', fontSize: '12px', color: '#666', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

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

// ─────────────────────────────────────────────────────────────
// 语言切换按钮（独立组件，因为需要 useLanguage hook）
// ─────────────────────────────────────────────────────────────

const LangSwitcher = ({ showSnackbar }) => {
  const { lang, setLang, SUPPORTED_LANGS, t, loadedLang } = useLanguage();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [pendingLang, setPendingLang] = useState(null);

  // 当目标语言包加载完成后再显示 snackbar
  useEffect(() => {
    if (pendingLang && loadedLang === pendingLang) {
      const label = SUPPORTED_LANGS.find(l => l.id === pendingLang)?.label ?? pendingLang;
      showSnackbar(t('lang.switched', { name: label }), 'info');
      setPendingLang(null);
    }
  }, [loadedLang, pendingLang, showSnackbar, t, SUPPORTED_LANGS]);

  const handleToggle = (e) => setAnchorEl(prev => prev ? null : e.currentTarget);
  const handleClose = () => {
    if (document.activeElement) {
      document.activeElement.blur();
    }
    setAnchorEl(null);
  };

  const handleSelect = (newLang) => {
    // 先移除焦点，再关闭菜单（避免 aria-hidden 警告）
    if (document.activeElement) {
      document.activeElement.blur();
    }
    handleClose();
    if (newLang === lang) return;
    setPendingLang(newLang);
    setLang(newLang);
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleToggle}
        sx={{
          bgcolor: 'background.paper',
          boxShadow: 2,
          '&:hover': {
            boxShadow: 4,
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.8),
          },
        }}
      >
        <LanguageIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ zIndex: 1301 }}
        slotProps={{
          paper: {
            elevation: 4,
            sx: { mt: 0.5, minWidth: 130 },
          },
        }}
      >
        {SUPPORTED_LANGS.map(({ id, label }) => (
          <MenuItem
            key={id}
            value={id}
            selected={id === lang}
            onClick={() => handleSelect(id)}
            sx={{ fontSize: '0.875rem' }}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// App 内层（已能访问 ThemeProvider 和 SnackbarContext）
// ─────────────────────────────────────────────────────────────

function AppInner({ darkMode, setDarkMode, schemeId, handleSetScheme }) {
  const { t, loadedLang } = useLanguage();

  const [snackbarQueue, setSnackbarQueue] = useState([]);

  const showSnackbar = (message, severity = 'info') => {
    const id = Date.now();
    setSnackbarQueue([{ id, message, severity }]);
  };

  const closeSnackbar = (id) => {
    setSnackbarQueue(prev => prev.filter(item => item.id !== id));
  };

  const theme = getTheme(schemeId, darkMode ? 'dark' : 'light');

  // 仅初始加载时等待（loadedLang 初始为 null）
  // 切换语言时 loadedLang 不重置，旧语言继续显示，无 loading
  if (!loadedLang) {
    return null;
  }

  return (
    <ThemeSchemeContext.Provider value={{ schemeId, setSchemeId: handleSetScheme }}>
      <SnackbarContext.Provider value={showSnackbar}>
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
            <LangSwitcher showSnackbar={showSnackbar} />

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
                sx={{ minWidth: '200px' }}
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
