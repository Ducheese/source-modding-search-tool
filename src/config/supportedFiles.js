/**
 * 支持的文件扩展名配置
 * 统一管理，避免在多处重复定义
 */

/**
 * 支持的文件扩展名列表
 * 用于文件选择对话框和文件验证
 */
export const SUPPORTED_EXTENSIONS = [
  'sp', 'cfg', 'ini', 'txt', 'vmt', 'qc',
  'inc', 'lua', 'log', 'vdf', 'scr', 'res', 'nut'
];

/**
 * 获取带点前缀的扩展名列表（用于显示和匹配）
 * @returns {string[]}
 */
export function getSupportedExtensionsWithDot() {
  return SUPPORTED_EXTENSIONS.map(ext => `.${ext}`);
}
