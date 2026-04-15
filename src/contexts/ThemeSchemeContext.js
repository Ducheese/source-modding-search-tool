import { createContext, useContext } from 'react';

/**
 * @typedef {Object} ThemeSchemeContextValue
 * @property {number} schemeId - 当前配色方案 ID (0-7)
 * @property {function(number): void} setSchemeId - 设置配色方案 ID 的函数
 */

/**
 * 主题配色方案上下文
 * 用于在组件树中共享当前配色方案 ID 和设置函数
 * 
 * @type {import('react').Context<ThemeSchemeContextValue | undefined>}
 */
const ThemeSchemeContext = createContext();

/**
 * 主题配色方案 Provider
 * @type {import('react').Provider<ThemeSchemeContextValue>}
 */
export const ThemeSchemeProvider = ThemeSchemeContext.Provider;

/**
 * 获取主题配色方案上下文值的 Hook
 * @returns {ThemeSchemeContextValue} 包含 schemeId 和 setSchemeId 的对象
 * @throws {Error} 如果在 ThemeSchemeProvider 外使用
 */
export const useThemeScheme = () => {
  const context = useContext(ThemeSchemeContext);
  if (!context) throw new Error('useThemeScheme must be used within a ThemeSchemeProvider');
  return context;
};

export default ThemeSchemeContext;
