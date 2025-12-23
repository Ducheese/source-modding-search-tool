import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { IconButton } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import MainLayout from './components/MainLayout';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    // 跟随系统主题
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
        <IconButton
          color="inherit"
          onClick={() => setDarkMode(!darkMode)}
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
    </ThemeProvider>
  );
}

export default App;