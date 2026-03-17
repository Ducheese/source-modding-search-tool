// Material UI组件库
import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  IconButton,
  Snackbar,
  Alert,
  Slide,
  Select,
  MenuItem,
} from '@mui/material';
import { ThemeProvider, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

// 自定义组件
import MainLayout from './components/MainLayout';
import { COLOR_SCHEME_STORAGE_KEY, THEMES } from './utils/themeConfig';
import { LanguageProvider, useLanguage } from './utils/i18n';

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
  const { lang, setLang, SUPPORTED_LANGS, t } = useLanguage();

  const handleChange = (e) => {
    const newLang = e.target.value;
    const label = SUPPORTED_LANGS.find(l => l.id === newLang)?.label ?? newLang;
    setLang(newLang);
    showSnackbar(t('lang.switched', { name: label }), 'info');
  };

  return (
    <Select
      value={lang}
      onChange={handleChange}
      size="small"
      variant="outlined"
      sx={{
        bgcolor: 'background.paper',
        boxShadow: 2,
        borderRadius: 1,
        fontSize: '0.8rem',
        height: 40,
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
        '&:hover': { boxShadow: 4 },
      }}
    >
      {SUPPORTED_LANGS.map(({ id, label }) => (
        <MenuItem key={id} value={id} sx={{ fontSize: '0.85rem' }}>
          {label}
        </MenuItem>
      ))}
    </Select>
  );
};

// ─────────────────────────────────────────────────────────────
// App 内层（已能访问 ThemeProvider 和 SnackbarContext）
// ─────────────────────────────────────────────────────────────

function AppInner({ darkMode, setDarkMode, schemeId, handleSetScheme }) {
  const { t } = useLanguage();

  const [snackbarQueue, setSnackbarQueue] = useState([]);

  const showSnackbar = (message, severity = 'info') => {
    const id = Date.now();
    setSnackbarQueue([{ id, message, severity }]);
  };

  const closeSnackbar = (id) => {
    setSnackbarQueue(prev => prev.filter(item => item.id !== id));
  };

  const theme = THEMES[schemeId][darkMode ? 1 : 0];

  return (
    <ThemeSchemeContext.Provider value={{ schemeId, setSchemeId: handleSetScheme }}>
      <SnackbarContext.Provider value={showSnackbar}>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          {/* 右上角固定按钮组（语言切换 + 深浅色，zIndex 1301） */}
          <div
            style={{
              position: 'fixed',
              top: 24,
              right: 24,
              zIndex: 1301,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
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
    return Number.isFinite(saved) && saved >= 0 && saved < THEMES.length ? saved : 0;
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
