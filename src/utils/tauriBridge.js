import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { open as openShell } from '@tauri-apps/api/shell';
import { loadSupportedExtensions } from '../config/supportedFiles';

// ─────────────────────────────────────────────────────────────
// 统一错误处理层
// ─────────────────────────────────────────────────────────────

/**
 * 包装 Tauri invoke 调用，提供统一的错误处理
 * @param {string} cmd - Tauri 命令名
 * @param {object} args - 命令参数
 * @param {object} options - 可选配置
 * @param {boolean} options.silent - 是否静默失败（不打印错误）
 * @returns {Promise<any>}
 */
const invokeWithError = async (cmd, args = {}, options = {}) => {
  const { silent = false } = options;
  const startTime = Date.now();

  try {
    const result = await invoke(cmd, args);
    // 可选：记录成功调用的耗时（调试用）
    // console.debug(`[tauriBridge] ${cmd} succeeded in ${Date.now() - startTime}ms`);
    return result;
  } catch (error) {
    // 统一错误格式化
    const errorInfo = {
      command: cmd,
      args,
      originalError: error,
      message: error?.message || String(error),
      timestamp: new Date().toISOString(),
    };

    if (!silent) {
      console.error(`[tauriBridge] ${cmd} failed:`, errorInfo);
    }

    // 抛出格式化后的错误，保留原始错误作为 cause
    throw new Error(`Tauri command "${cmd}" failed: ${errorInfo.message}`, { cause: error });
  }
};

// 模拟原有的 electronAPI 接口，但调用 Rust 后端
export const tauriAPI = {
  selectFiles: async () => {
    const supportedExtensions = loadSupportedExtensions();
    const selected = await open({
      multiple: true,
      ...(supportedExtensions.length > 0 && {
        filters: [{
          name: 'Source Files',
          extensions: supportedExtensions,
        }],
      }),
    });
    return selected === null ? [] : (Array.isArray(selected) ? selected : [selected]);
  },

  selectFolder: async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    return selected;
  },

  readFile: async (filePath) => {
    return await invokeWithError('read_file', { path: filePath });
  },

  openFileExternally: async (filePath) => {
    await openShell(filePath);
  },

  scanDirectory: async (dirPath) => {
    return await invokeWithError('scan_directory', { dirPath });
  },

  // 批量获取文件统计，这是新加的接口，比以前一个一个循环快了无数倍
  getFileStatsBatch: async (filePaths) => {
    return await invokeWithError('get_file_stats', { filePaths });
  },

  // 核心：调用 Rust 进行搜索
  searchInFiles: async (files, options) => {
    // files 是一个对象数组，我们需要提取路径字符串
    const filePaths = files.map(f => f.path);
    return await invokeWithError('search_in_files', {
      files: filePaths,
      options: {
        query: options.query,
        case_sensitive: options.caseSensitive,
        whole_word: options.wholeWord,
        use_regex: options.useRegex,
        // 【新增】呈上那两份至关重要的“结界图纸”
        // 注意：这里的命名必须与 Rust 函数的参数名完全一致！
        include_pattern: options.includePattern,
        exclude_pattern: options.excludePattern,
        context_lines: options.contextLines,
      }
    });
  },
  
  // AI写正则
  generateAiRegex: async (payload) => {
    return await invokeWithError('generate_ai_regex', { request: payload });
  },

  // 测试连接
  testAiConnection: async (payload) => {
    return await invokeWithError('test_ai_connection', { request: payload });
  },

  // AI流式对话
  streamAiChat: async (payload) => {
    return await invokeWithError('stream_ai_chat', { request: payload });
  },

  // 提交反馈（通用接口，支持翻译反馈、Bug报告等多种类型）
  submitFeedback: async (feedback) => {
    return await invokeWithError('submit_feedback', { feedback });
  },
};
