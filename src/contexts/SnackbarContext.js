import { createContext, useContext } from 'react';

/**
 * @typedef {(message: string, severity?: 'success' | 'warning' | 'error' | 'info') => void} ShowSnackbarFunction
 */

/**
 * Snackbar 上下文
 * 用于在组件树中共享 showSnackbar 函数
 * 
 * @type {import('react').Context<ShowSnackbarFunction | undefined>}
 */
const SnackbarContext = createContext();

/**
 * Snackbar Provider
 * @type {import('react').Provider<ShowSnackbarFunction>}
 */
export const SnackbarProvider = SnackbarContext.Provider;

/**
 * 获取 Snackbar 上下文值的 Hook
 * @returns {ShowSnackbarFunction} showSnackbar 函数
 * @throws {Error} 如果在 SnackbarProvider 外使用
 */
export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (!context) throw new Error('useSnackbar must be used within a SnackbarProvider');
  return context;
};

export default SnackbarContext;
