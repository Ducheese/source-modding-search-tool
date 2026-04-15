import { createTheme } from '@mui/material/styles';
import {
  SCHEME_PALETTES,
  COMMON_TYPOGRAPHY,
  COMMON_COMPONENTS_LIGHT,
  COMMON_COMPONENTS_DARK,
} from '../config/colorSchemes';

// 主题缓存
const themeCache = {};

/**
 * 获取主题（懒加载 + 缓存）
 * @param {number} schemeId - 方案 ID (0-7)
 * @param {'light' | 'dark'} mode - 模式
 * @returns {object} MUI 主题对象
 */
export const getTheme = (schemeId, mode) => {
  const modeIndex = mode === 'dark' ? 1 : 0;
  const key = `${schemeId}-${mode}`;

  if (!themeCache[key]) {
    const palette = SCHEME_PALETTES[schemeId]?.[modeIndex];
    if (!palette) {
      console.warn(`Unknown theme: schemeId=${schemeId}, mode=${mode}`);
      return null;
    }

    themeCache[key] = createTheme({
      palette,
      typography: COMMON_TYPOGRAPHY,
      components: mode === 'dark' ? COMMON_COMPONENTS_DARK : COMMON_COMPONENTS_LIGHT,
    });
  }

  return themeCache[key];
};
