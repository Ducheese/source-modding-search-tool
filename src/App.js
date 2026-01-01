// Material UI组件库
import React, { useState, useEffect, createContext, useContext } from 'react';
import { IconButton, Snackbar, Alert, Slide } from '@mui/material';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

// 自定义组件
import MainLayout from './components/MainLayout';

{/* 色彩方案 */}

// 浅色主题 (lightTheme)
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6200EE',
      // Primary Variant 700
      dark: '#3700B3', 
      // 明确设置 onPrimary，覆盖默认的 text.primary
      contrastText: '#FFFFFF', // 这是 MUI 中 onPrimary 的作用
    },
    secondary: {
      main: '#03DAC6',
      // Secondary Variant 900
      dark: '#018786',
      // 明确设置 onSecondary
      contrastText: '#000000', // 这是 MUI 中 onSecondary 的作用
    },
    background: {
      default: '#FFFFFF',
      paper: '#FFFFFF',
    },
    // ... 其他颜色 (Error)
    error: {
      main: '#B00020',
      contrastText: '#FFFFFF', // on Error
    },
    // 明确设置 On Background 和 On Surface (通常映射到 text.primary/secondary)
    text: {
      primary: '#000000', // On Background / On Surface
      secondary: 'rgba(0, 0, 0, 0.6)',
    },
    // ... 可以通过添加自定义属性来存储 OnBackground/OnSurface 纯色值，或者依赖 text.primary
    // Material UI 会使用 contrastText 作为 On 颜色。
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", "Noto Sans SC", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

// 深色主题 (darkTheme)
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#BB86FC',
      dark: '#3700B3', // Primary Variant 700
      // 明确设置 onPrimary
      contrastText: '#000000', // 这是 MUI 中 onPrimary 的作用 (在 #BB86FC 上用黑色文本)
    },
    secondary: {
      main: '#03DAC6',
      // 明确设置 onSecondary
      contrastText: '#000000', // 这是 MUI 中 onSecondary 的作用 (在 #03DAC6 上用黑色文本)
    },
    background: {
      default: '#121212',
      paper: '#121212',
    },
    // ... 其他颜色 (Error)
    error: {
      main: '#CF6679',
      contrastText: '#000000', // on Error
    },
    // 明确设置 On Background 和 On Surface (通常映射到 text.primary/secondary)
    text: {
      primary: '#FFFFFF', // On Background / On Surface
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
    // ...
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", "Noto Sans SC", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: '#1e1e1e',
        },
      },
    },
  },
});

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

  {/* 色彩方案移到App外，防止重复创建 */}

  const theme = darkMode ? darkTheme : lightTheme;   // 位置不能往前放，lightTheme 和 darkTheme 还未被声明！

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
    <SnackbarContext.Provider value={showSnackbar}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        {/* 深浅色模式切换按钮，纵深次序1000 */}
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
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
  );
}
export default App;