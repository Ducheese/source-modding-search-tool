import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

const VALIDATED_FILE_DRAG_EVENT = 'validated-file-drag';

/**
 * 从事件 payload 中提取路径数组
 * @param {unknown} payload
 * @returns {string[]}
 */
function extractPaths(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.paths)) return payload.paths;
  return [];
}

/**
 * 只监听 Rust 后端 emit 的"已验证文件拖拽事件"
 * 前端不再直接监听 tauri://file-drop-hover / cancelled / drop
 *
 * @param {Object} options
 * @param {function} [options.onDrop] - 文件释放回调，接收路径数组
 * @returns {{ isFileDragActive: boolean }} 拖拽状态
 */
export function useWindowFileDrop({ onDrop } = {}) {
  const [isFileDragActive, setIsFileDragActive] = useState(false);

  useEffect(() => {
    let disposed = false;

    const reset = () => {
      if (!disposed) {
        setIsFileDragActive(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reset();
      }
    };

    const unlistenPromise = listen(VALIDATED_FILE_DRAG_EVENT, async (event) => {
      const payload = event.payload ?? {};

      switch (payload.type) {
        case 'enter':
          if (!disposed) {
            setIsFileDragActive(true);
          }
          break;

        case 'leave':
          reset();
          break;

        case 'drop': {
          reset();

          const paths = extractPaths(payload);
          if (!paths.length) return;

          try {
            await onDrop?.(paths);
          } catch (error) {
            console.error('Handle validated dropped paths failed:', error);
          }
          break;
        }

        default:
          break;
      }
    });

    // 前端也保留兜底 reset，但它现在只是兜底，不再是核心判断来源
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [onDrop]);

  return { isFileDragActive };
}
