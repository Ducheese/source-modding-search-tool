import { createContext, useContext } from 'react';

/**
 * Snackbar 上下文
 * 用于在组件树中共享 showSnackbar 函数
 */

const SnackbarContext = createContext();

export const SnackbarProvider = SnackbarContext.Provider;

export const useSnackbar = () => useContext(SnackbarContext);

export default SnackbarContext;
