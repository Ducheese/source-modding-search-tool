/**
 * 文件处理工具函数
 * 用于 FileDropZone 和 FileList 组件
 */

import { SUPPORTED_EXTENSIONS } from '../config/supportedFiles';

// 带点前缀的扩展名列表（用于匹配）
const SUPPORTED_EXTENSIONS_WITH_DOT = SUPPORTED_EXTENSIONS.map(ext => `.${ext}`);

/**
 * 从完整路径中提取文件名
 * @param {string} path - 完整文件路径
 * @returns {string} 文件名
 */
export function getFileName(path) {
  return path.split(/[\\/]/).pop();
}

/**
 * 检查文件是否为支持的格式
 * @param {string} fileName - 文件名
 * @returns {boolean}
 */
export function isSupportedFile(fileName) {
  const ext = '.' + fileName.split('.').pop().toLowerCase();
  return SUPPORTED_EXTENSIONS_WITH_DOT.includes(ext);
}

/**
 * 将路径转换为文件条目对象
 * @param {string} path - 文件路径
 * @returns {{ path: string, name: string, isFile: boolean }}
 */
export function toFileEntry(path) {
  return {
    path,
    name: getFileName(path),
    isFile: true,
  };
}

/**
 * 过滤有效文件，分离有效和无效的文件
 * @param {string[]} paths - 文件路径数组
 * @returns {{ valid: Array, invalid: Array }}
 */
export function filterValidFiles(paths) {
  const valid = [];
  const invalid = [];
  
  paths.forEach(path => {
    const name = getFileName(path);
    if (isSupportedFile(name)) {
      valid.push(toFileEntry(path));
    } else {
      invalid.push(name);
    }
  });
  
  return { valid, invalid };
}

/**
 * 获取支持的文件扩展名列表（用于提示，带点前缀）
 * @returns {string[]}
 */
export function getSupportedExtensions() {
  return [...SUPPORTED_EXTENSIONS_WITH_DOT];
}

// ─────────────────────────────────────────────────────────────
// 文件信息格式化
// ─────────────────────────────────────────────────────────────

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的字符串
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * 截断路径显示
 * @param {string} path - 完整路径
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的路径
 */
export function truncatePath(path, maxLength = 40) {
  if (!path || path.length <= maxLength) return path;
  const parts = path.split(/[\\/]/);
  if (parts.length <= 2) return path;
  return '…\\' + parts[parts.length - 2] + '\\' + parts[parts.length - 1];
}

/**
 * 根据编码类型返回对应的颜色
 * @param {string} encoding - 编码类型
 * @returns {'success' | 'warning' | 'info' | 'default'} MUI Chip 颜色
 */
export function getEncodingColor(encoding) {
  const cleanEncoding = encoding?.toLowerCase().replace(/ with bom/i, '');

  switch (cleanEncoding) {
    case 'utf-8':
    case 'utf8':
    case 'ascii':
      return 'success';
    case 'gbk':
    case 'gb2312':
    case 'gb18030':
      return 'warning';
    case 'utf-16':
    case 'utf-16le':
    case 'utf-16be':
      return 'info';
    default:
      if (cleanEncoding && (cleanEncoding.includes('windows-') || cleanEncoding.includes('shift-jis'))) {
        return 'warning';
      }
      return 'default';
  }
}
