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
 * @returns {ShowSnackbarFunction | undefined} showSnackbar 函数
 */
export const useSnackbar = () => useContext(SnackbarContext);

export default SnackbarContext;
