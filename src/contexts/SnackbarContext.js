import { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, Slide } from '@mui/material';

/**
 * Snackbar 上下文
 * 内部管理 snackbar 状态并渲染
 */

const SnackbarContext = createContext();

/**
 * Snackbar Provider
 * 内部管理 snackbar 状态和渲染
 */
export const SnackbarProvider = ({ children }) => {
  const [activeSnackbar, setActiveSnackbar] = useState(null);

  const showSnackbar = useCallback((message, severity = 'info') => {
    const id = Date.now();
    setActiveSnackbar({ id, message, severity });
  }, []);

  const closeSnackbar = useCallback(() => {
    setActiveSnackbar(null);
  }, []);

  return (
    <SnackbarContext.Provider value={showSnackbar}>
      {children}
      
      {activeSnackbar && (
        <Snackbar
          key={activeSnackbar.id}
          open={true}
          autoHideDuration={2000}
          onClose={closeSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          TransitionComponent={Slide}
          TransitionProps={{ direction: 'up' }}
        >
          <Alert
            onClose={closeSnackbar}
            severity={activeSnackbar.severity}
            sx={{ minWidth: '200px' }}
          >
            {activeSnackbar.message}
          </Alert>
        </Snackbar>
      )}
    </SnackbarContext.Provider>
  );
};

/**
 * 获取 showSnackbar 函数的 Hook
 * @returns {function(string, string?): void} showSnackbar(message, severity?)
 * @throws {Error} 如果在 SnackbarProvider 外使用
 */
export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (!context) throw new Error('useSnackbar must be used within a SnackbarProvider');
  return context;
};

export default SnackbarContext;
