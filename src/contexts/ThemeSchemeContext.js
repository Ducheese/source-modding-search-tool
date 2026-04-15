import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { COLOR_SCHEMES } from '../config/colorSchemes';
import { COLOR_SCHEME_STORAGE_KEY } from '../config/storageKeys';

/**
 * @typedef {Object} ThemeSchemeContextValue
 * @property {number} schemeId - 当前配色方案 ID (0-7)
 * @property {function(number): void} setSchemeId - 设置配色方案 ID 的函数
 * @property {boolean} darkMode - 当前是否为深色模式
 * @property {function(boolean): void} setDarkMode - 设置深色模式的函数
 */

/**
 * 主题配色方案上下文
 * 管理配色方案 (schemeId) 和深浅色模式 (darkMode)
 */
const ThemeSchemeContext = createContext();

/**
 * 主题配色方案 Provider
 * 内部管理 schemeId + darkMode 状态和持久化
 */
export const ThemeSchemeProvider = ({ children }) => {
  // schemeId：从 localStorage 读取，默认 0
  const [schemeId, setSchemeIdState] = useState(() => {
    const saved = parseInt(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY), 10);
    return Number.isFinite(saved) && saved >= 0 && saved < COLOR_SCHEMES.length ? saved : 0;
  });

  // darkMode：默认跟随系统偏好
  const [darkMode, setDarkModeState] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // 监听系统偏好变化
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setDarkModeState(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // body class 同步（供 index.css 感知深浅色）
  useEffect(() => {
    document.body.classList.toggle('dark-theme', darkMode);
  }, [darkMode]);

  // 设置 schemeId 并持久化
  const setSchemeId = useCallback((id) => {
    if (id >= 0 && id < COLOR_SCHEMES.length) {
      setSchemeIdState(id);
      localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, String(id));
    }
  }, []);

  // 设置 darkMode
  const setDarkMode = useCallback((value) => {
    setDarkModeState(value);
  }, []);

  return (
    <ThemeSchemeContext.Provider value={{ schemeId, setSchemeId, darkMode, setDarkMode }}>
      {children}
    </ThemeSchemeContext.Provider>
  );
};

/**
 * 获取主题配色方案上下文值的 Hook
 * @returns {ThemeSchemeContextValue}
 * @throws {Error} 如果在 ThemeSchemeProvider 外使用
 */
export const useThemeScheme = () => {
  const context = useContext(ThemeSchemeContext);
  if (!context) throw new Error('useThemeScheme must be used within a ThemeSchemeProvider');
  return context;
};

export default ThemeSchemeContext;
