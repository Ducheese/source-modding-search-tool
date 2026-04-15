import { createContext, useContext } from 'react';

/**
 * 主题配色方案上下文
 * 用于在组件树中共享当前配色方案 ID 和设置函数
 */

const ThemeSchemeContext = createContext();

export const ThemeSchemeProvider = ThemeSchemeContext.Provider;

export const useThemeScheme = () => useContext(ThemeSchemeContext);

export default ThemeSchemeContext;
