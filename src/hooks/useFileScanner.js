import { useCallback, useRef, useState } from 'react';
import { tauriAPI } from '../utils/tauriBridge';
import { filterValidFiles, getSupportedExtensions } from '../utils/fileUtils';

// ============================================================================
// 常量定义
// ============================================================================

/** 拖拽扫描的并发上限 */
const DROP_SCAN_CONCURRENCY = 2;

/** 支持的文件扩展名文本（用于错误提示） */
const SUPPORTED_EXTENSIONS_TEXT = getSupportedExtensions().join(', ');

// ============================================================================
// 纯工具函数（不依赖 React 状态）
// ============================================================================

/**
 * 有限并发扫描多个路径
 * - 保留输入顺序
 * - 每个 path 扫完立刻过滤，降低内存峰值
 * - 控制同时进行的扫描数量
 * 
 * @param {string[]} paths - 要扫描的路径列表
 * @param {number} limit - 并发上限
 * @param {(path: string) => Promise<string[]>} scanFn - 扫描函数
 * @param {(scanned: string[]) => { valid: Array, invalid: Array }} filterFn - 过滤函数
 * @returns {Promise<{ valid: Array, invalid: Array }>} 扫描结果
 */
async function scanPathsWithLimit(paths, limit, scanFn, filterFn) {
  const results = new Array(paths.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= paths.length) return;

      try {
        const scanned = await scanFn(paths[currentIndex]);
        results[currentIndex] = filterFn(scanned);
      } catch {
        results[currentIndex] = { valid: [], invalid: [] };
      }
    }
  }

  const workerCount = Math.min(limit, paths.length);

  await Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );

  return {
    valid: results.flatMap(item => item?.valid || []),
    invalid: results.flatMap(item => item?.invalid || []),
  };
}

/**
 * 格式化无效文件列表（用于错误提示）
 * 
 * @param {string[]} invalid - 无效文件列表
 * @param {number} limit - 显示上限，默认 5
 * @returns {string} 格式化后的字符串
 */
function formatInvalidList(invalid, limit = 5) {
  const preview = invalid.slice(0, limit).join(', ');
  return invalid.length > limit
    ? `${preview} ... (+${invalid.length - limit})`
    : preview;
}

/**
 * 构建"不支持文件类型"的提示文案
 * 
 * @param {Function} t - 翻译函数
 * @param {string} titleKey - 标题翻译 key
 * @param {string[]} invalid - 无效文件列表
 * @returns {string} 完整的错误提示文案，无无效文件时返回空字符串
 */
function buildUnsupportedFilesMessage(t, titleKey, invalid) {
  if (!invalid?.length) return '';

  return (
    `${t(titleKey)}\n` +
    `${formatInvalidList(invalid)}\n\n` +
    `${t('dropzone.errorSupportedTypes')} ${SUPPORTED_EXTENSIONS_TEXT}`
  );
}

/**
 * 处理拖拽传入的路径：逐个递归扫描，再过滤有效文件
 * 
 * @param {string[]} paths - 拖拽传入的路径列表
 * @returns {Promise<{ valid: Array, invalid: Array }>} 扫描结果
 */
async function scanDroppedPaths(paths) {
  return scanPathsWithLimit(
    paths,
    DROP_SCAN_CONCURRENCY,
    (path) => tauriAPI.scanDirectory(path),
    filterValidFiles
  );
}

/**
 * 处理选择的文件夹：递归扫描，再过滤有效文件
 * 
 * @param {string} folderPath - 文件夹路径
 * @returns {Promise<{ valid: Array, invalid: Array }>} 扫描结果
 */
async function scanSelectedFolder(folderPath) {
  const scannedFiles = await tauriAPI.scanDirectory(folderPath);
  return filterValidFiles(scannedFiles);
}

// ============================================================================
// Hook 定义
// ============================================================================

/**
 * 文件扫描 Hook
 * 
 * 职责：
 * - 处理拖拽传入的路径
 * - 选择文件
 * - 选择文件夹
 * - 统一 busy 状态与错误提示
 * 
 * @param {Object} options - 配置选项
 * @param {function} options.onFilesAdded - 文件添加回调，接收有效文件列表
 * @param {function} options.showErrorAlert - 显示错误提示函数
 * @param {function} options.t - 翻译函数
 * @returns {{
 *   selectFiles: function,
 *   selectFolder: function,
 *   handleDroppedPaths: function,
 *   isBusy: boolean
 * }}
 */
export function useFileScanner({ onFilesAdded, showErrorAlert, t }) {
  // --------------------------------------------------------------------------
  // 状态定义
  // --------------------------------------------------------------------------

  /** UI 忙碌状态（用于显示加载指示器） */
  const [isBusy, setIsBusy] = useState(false);

  /** 互斥锁（用于防止重复触发，同步判断避免竞态条件） */
  const busyRef = useRef(false);

  // --------------------------------------------------------------------------
  // 核心工具函数
  // --------------------------------------------------------------------------

  /**
   * 互斥执行，避免重复触发导入流程
   * 
   * @param {() => Promise<void>} task - 要执行的任务
   */
  const runExclusive = useCallback(async (task) => {
    if (busyRef.current) return;

    busyRef.current = true;
    setIsBusy(true);

    try {
      await task();
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }, []);

  /**
   * 提示不支持的文件类型
   * 
   * @param {string} titleKey - 标题翻译 key
   * @param {string[]} invalid - 无效文件列表
   */
  const notifyUnsupportedFiles = useCallback((titleKey, invalid) => {
    const message = buildUnsupportedFilesMessage(t, titleKey, invalid);
    if (message) {
      showErrorAlert?.(message);
    }
  }, [showErrorAlert, t]);

  /**
   * 提交有效文件到上层
   * 
   * @param {Array} valid - 有效文件列表
   * @returns {boolean} 是否存在有效文件
   */
  const commitValidFiles = useCallback((valid) => {
    if (!valid?.length) return false;
    onFilesAdded?.(valid);
    return true;
  }, [onFilesAdded]);

  // --------------------------------------------------------------------------
  // Action 函数
  // --------------------------------------------------------------------------

  /**
   * 处理拖拽传入的路径
   * 
   * @param {string[]} paths - 拖拽传入的路径列表
   */
  const handleDroppedPaths = useCallback(async (paths) => {
    await runExclusive(async () => {
      if (!paths?.length) return;

      try {
        const { valid, invalid } = await scanDroppedPaths(paths);
        notifyUnsupportedFiles('dropzone.errorTitle', invalid);
        commitValidFiles(valid);
      } catch (error) {
        console.error('File drop scan failed:', error);
      }
    });
  }, [runExclusive, notifyUnsupportedFiles, commitValidFiles]);

  /**
   * 选择文件（通过系统文件选择器）
   */
  const selectFiles = useCallback(async () => {
    await runExclusive(async () => {
      try {
        const filePaths = await tauriAPI.selectFiles();
        if (!filePaths?.length) return;

        const { valid, invalid } = filterValidFiles(filePaths);
        notifyUnsupportedFiles('dropzone.errorTitle', invalid);
        commitValidFiles(valid);
      } catch (error) {
        console.error('Failed to select files:', error);
      }
    });
  }, [runExclusive, notifyUnsupportedFiles, commitValidFiles]);

  /**
   * 选择文件夹（通过系统文件夹选择器）
   */
  const selectFolder = useCallback(async () => {
    await runExclusive(async () => {
      try {
        const folderPath = await tauriAPI.selectFolder();
        if (!folderPath) return;

        const { valid, invalid } = await scanSelectedFolder(folderPath);
        notifyUnsupportedFiles('dropzone.errorFolderTitle', invalid);

        if (!commitValidFiles(valid)) {
          showErrorAlert?.(t('dropzone.errorNoFiles'));
        }
      } catch (error) {
        console.error('Failed to select folder:', error);
      }
    });
  }, [runExclusive, notifyUnsupportedFiles, commitValidFiles, showErrorAlert, t]);

  // --------------------------------------------------------------------------
  // 返回值
  // --------------------------------------------------------------------------

  return {
    selectFiles,
    selectFolder,
    handleDroppedPaths,
    isBusy,
  };
}
