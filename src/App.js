import React, { useState, useEffect, createContext, useContext } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { IconButton, Snackbar, Alert, Slide } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import MainLayout from './components/MainLayout';

// Snackbar Context
const SnackbarContext = createContext();

export const useSnackbar = () => useContext(SnackbarContext);

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    // 跟随系统主题
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

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

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 浅色主题
  const lightTheme = createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: '#6200EE',
      },
      secondary: {
        main: '#03DAC6',
      },
      background: {
        default: '#FFFFFF',
        paper: '#FFFFFF',
      },
      error: {
        main: '#B00020',
      },
      text: {
        primary: '#000000',
        secondary: 'rgba(0, 0, 0, 0.6)',
      },
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

  // 深色主题
  const darkTheme = createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#BB86FC',
      },
      secondary: {
        main: '#03DAC6',
      },
      background: {
        default: '#121212',
        paper: '#121212',
      },
      error: {
        main: '#CF6679',
      },
      text: {
        primary: '#FFFFFF',
        secondary: 'rgba(255, 255, 255, 0.7)',
      },
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

  const theme = darkMode ? darkTheme : lightTheme;

  return (
    <SnackbarContext.Provider value={showSnackbar}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
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
              boxShadow: 2,
              '&:hover': {
                bgcolor: 'background.paper',
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
            autoHideDuration={3000}
            onClose={() => closeSnackbar(item.id)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            TransitionComponent={Slide}
            TransitionProps={{ direction: 'up' }}
          >
            <Alert
              onClose={() => closeSnackbar(item.id)}
              severity={item.severity}
              sx={{ minWidth: '300px' }}
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