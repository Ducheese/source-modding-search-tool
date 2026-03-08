import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { open as openShell } from '@tauri-apps/api/shell';

// 模拟原有的 electronAPI 接口，但调用 Rust 后端
export const tauriAPI = {
  selectFiles: async () => {
    const selected = await open({
      multiple: true,
      filters: [{
        name: 'Source Files',
        extensions: ['sp', 'cfg', 'ini', 'txt', 'vmt', 'qc', 'inc', 'lua', 'log', 'vdf', 'scr']
      }]
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
    return await invoke('read_file', { path: filePath });
  },

  openFileExternally: async (filePath) => {
    await openShell(filePath);
  },

  scanDirectory: async (dirPath) => {
    return await invoke('scan_directory', { dirPath });
  },

  // 批量获取文件统计，这是新加的接口，比以前一个一个循环快了无数倍
  getFileStatsBatch: async (filePaths) => {
    return await invoke('get_file_stats', { filePaths });
  },

  // 核心：调用 Rust 进行搜索
  searchInFiles: async (files, options) => {
    // files 是一个对象数组，我们需要提取路径字符串
    const filePaths = files.map(f => f.path);
    return await invoke('search_in_files', {
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
    return await invoke('generate_ai_regex', { request: payload });
  },

  // 测试连接
  testAiConnection: async (payload) => {
    return await invoke('test_ai_connection', { request: payload });
  }
};
