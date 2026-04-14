import { useEffect, useCallback, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { tauriAPI } from '../utils/tauriBridge';
import { filterValidFiles, getSupportedExtensions } from '../utils/fileUtils';

/**
 * 文件扫描 Hook
 * 处理 Tauri 全局拖拽事件和文件/文件夹选择
 * @param {Object} options
 * @param {function} options.onFilesAdded - 文件添加回调
 * @param {function} options.showErrorAlert - 显示错误提示
 * @param {function} options.t - 翻译函数
 * @returns {{ selectFiles: function, selectFolder: function, isDragOver: boolean }}
 */
export function useFileScanner({ onFilesAdded, showErrorAlert, t }) {
  const [isDragOver, setIsDragOver] = useState(false);

  // 监听 Tauri 全局拖拽事件
  useEffect(() => {
    const unlistenPromise = listen('tauri://file-drop', async (event) => {
      setIsDragOver(false);
      const paths = event.payload;
      if (!paths?.length) return;

      try {
        // 并发扫描所有路径
        const results = await Promise.all(
          paths.map(path => tauriAPI.scanDirectory(path).catch(() => []))
        );

        const { valid, invalid } = filterValidFiles(results.flat());

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
      unlistenPromise.then(unlisten => unlisten());
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

  return { selectFiles, selectFolder, isDragOver, setIsDragOver };
}
