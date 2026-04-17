import { useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { tauriAPI } from '../utils/tauriBridge';
import { filterValidFiles, getSupportedExtensions } from '../utils/fileUtils';

/**
 * 有限并发扫描多个路径
 * - 保留输入顺序
 * - 每个 path 扫完立刻过滤，降低内存峰值
 * - 控制同时进行的扫描数量
 * @param {string[]} paths - 要扫描的路径列表
 * @param {number} limit - 并发上限
 * @param {function} scanFn - 扫描函数 (path) => Promise<string[]>
 * @param {function} filterFn - 过滤函数 (scanned) => { valid, invalid }
 * @returns {Promise<{ valid: string[], invalid: string[] }>}
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
 * 文件扫描 Hook
 * 处理 Tauri 全局拖拽事件和文件/文件夹选择
 * @param {Object} options
 * @param {function} options.onFilesAdded - 文件添加回调
 * @param {function} options.showErrorAlert - 显示错误提示（用于多行错误详情）
 * @param {function} options.t - 翻译函数
 * @returns {{ selectFiles: function, selectFolder: function }}
 */
export function useFileScanner({ onFilesAdded, showErrorAlert, t }) {
  // 监听 Tauri 文件拖拽事件
  useEffect(() => {
    const unlistenDropPromise = listen('tauri://file-drop', async (event) => {
      const paths = event.payload;
      if (!paths?.length) return;

      try {
        // 有限并发扫描（上限 2）
        const { valid, invalid } = await scanPathsWithLimit(
          paths,
          2,
          (path) => tauriAPI.scanDirectory(path),
          (scanned) => filterValidFiles(scanned)
        );

        if (invalid.length > 0) {
          const message = `${t('dropzone.errorTitle')}\n${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '...' : ''}\n\n${t('dropzone.errorSupportedTypes')} ${getSupportedExtensions().join(', ')}`;
          showErrorAlert?.(message);
        }

        if (valid.length > 0) {
          onFilesAdded?.(valid);
        }
      } catch (e) {
        console.error('File drop scan failed:', e);
      }
    });

    return () => {
      unlistenDropPromise.then(unlisten => unlisten());
    };
  }, [onFilesAdded, showErrorAlert, t]);

  // 选择文件
  const selectFiles = useCallback(async () => {
    try {
      const filePaths = await tauriAPI.selectFiles();
      if (!filePaths?.length) return;

      const { valid, invalid } = filterValidFiles(filePaths);

      if (invalid.length > 0) {
        const message = `${t('dropzone.errorTitle')}\n${invalid.join(', ')}\n\n${t('dropzone.errorSupportedTypes')} ${getSupportedExtensions().join(', ')}`;
        showErrorAlert?.(message);
      }

      if (valid.length > 0) {
        onFilesAdded?.(valid);
      }
    } catch (error) {
      console.error('Failed to select files:', error);
    }
  }, [onFilesAdded, showErrorAlert, t]);

  // 选择文件夹
  const selectFolder = useCallback(async () => {
    try {
      const folderPath = await tauriAPI.selectFolder();
      if (!folderPath) return;

      const scannedFiles = await tauriAPI.scanDirectory(folderPath);
      const { valid, invalid } = filterValidFiles(scannedFiles);

      if (invalid.length > 0) {
        const message = `${t('dropzone.errorFolderTitle')}\n${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '...' : ''}\n\n${t('dropzone.errorSupportedTypes')} ${getSupportedExtensions().join(', ')}`;
        showErrorAlert?.(message);
      }

      if (valid.length > 0) {
        onFilesAdded?.(valid);
      } else {
        showErrorAlert?.(t('dropzone.errorNoFiles'));
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }, [onFilesAdded, showErrorAlert, t]);

  return { selectFiles, selectFolder };
}
