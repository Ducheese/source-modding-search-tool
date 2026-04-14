/**
 * 文件处理工具函数
 * 用于 FileDropZone 和 FileList 组件
 */

// 支持的文件格式
const SUPPORTED_EXTENSIONS = [
  '.sp', '.cfg', '.ini', '.txt', '.vmt', '.qc', 
  '.inc', '.lua', '.log', '.vdf', '.scr', '.res', '.nut'
];

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
  return SUPPORTED_EXTENSIONS.includes(ext);
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
 * 获取支持的文件扩展名列表（用于提示）
 * @returns {string[]}
 */
export function getSupportedExtensions() {
  return [...SUPPORTED_EXTENSIONS];
}
