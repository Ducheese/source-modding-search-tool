import { tauriAPI } from './tauriBridge';

// 现在的 JS 只是一个发号施令的公主，脏活累活都给 Rust 做
export const searchInFiles = async (files, searchOptions) => {
  const startTime = Date.now();

  // 以前的复杂逻辑全部删除，直接调用 Rust
  // 须臾之间，结果即现
  let rustResults = [];
  try {
    rustResults = await tauriAPI.searchInFiles(files, searchOptions);
  } catch (error) {
    console.error("Rust search error:", error);
    throw new Error(`搜索失败: ${error}`);
  }

  // 转换结果格式以适配现有的 UI
  const totalMatches = rustResults.reduce((acc, file) => acc + file.matches.length, 0);

  const results = {
    query: searchOptions.query,
    options: searchOptions,
    totalFiles: files.length,
    matchedFiles: rustResults.length,
    totalMatches: totalMatches,
    files: rustResults,
    executionTime: Date.now() - startTime,
  };

  return results;
};

// 导出功能逻辑保持不变，因为这只是纯文本处理，不涉及繁重计算
export const exportResults = (results, format = 'txt') => {
  // ... (保持原有的 exportResults 代码不变，这部分性能瓶颈不大)
  // 为了节省篇幅，这里复用你之前的代码逻辑即可，因为数据结构已经对齐。
  if (!results || results.files.length === 0) {
    throw new Error('没有可导出的搜索结果');
  }

  let content = '';
  const timestamp = new Date().toLocaleString('zh-CN');

  if (format === 'txt') {
    content = `搜索结果导出\n`;
    content += `================\n\n`;
    content += `搜索内容: ${results.query}\n`;
    content += `搜索选项: ${JSON.stringify(results.options, null, 2)}\n`;
    content += `导出时间: ${timestamp}\n\n`;
    content += `统计信息:\n`;
    content += `- 总文件数: ${results.totalFiles}\n`;
    content += `- 匹配文件数: ${results.matchedFiles}\n`;
    content += `- 总匹配数: ${results.totalMatches}\n`;
    content += `- 执行时间: ${results.executionTime}ms\n\n`;

    results.files.forEach(file => {
      content += `文件: ${file.path}\n`;
      content += `${'='.repeat(file.path.length + 4)}\n\n`;

      file.matches.forEach(match => {
        content += `行 ${match.line_number}:\n`; // 注意：Rust返回的是 snake_case
        if (match.context.before) {
          content += `  ${match.line_number - 1}: ${match.context.before}\n`;
        }
        content += `> ${match.line_number}: ${match.line}\n`;
        if (match.context.after) {
          content += `  ${match.line_number + 1}: ${match.context.after}\n`;
        }
        content += '\n';
      });

      content += '\n';
    });
  } else if (format === 'md') {
    content = `# 搜索结果导出\n\n`;
    content += `**搜索内容:** \`${results.query}\`\n\n`;
    content += `**搜索选项:**\n\`\`\`json\n${JSON.stringify(results.options, null, 2)}\n\`\`\`\n\n`;
    content += `**导出时间:** ${timestamp}\n\n`;
    content += `## 统计信息\n\n`;
    content += `- 总文件数: ${results.totalFiles}\n`;
    content += `- 匹配文件数: ${results.matchedFiles}\n`;
    content += `- 总匹配数: ${results.totalMatches}\n`;
    content += `- 执行时间: ${results.executionTime}ms\n\n`;

    results.files.forEach(file => {
      content += `## ${file.name}\n\n`;
      content += `**路径:** \`${file.path}\`\n\n`;

      file.matches.forEach(match => {
        content += `### 行 ${match.line_number}\n\n`;
        content += '```text\n';
        if (match.context.before) {
          content += `${match.line_number - 1}: ${match.context.before}\n`;
        }
        content += `${match.line_number}: ${match.line}\n`;
        if (match.context.after) {
          content += `${match.line_number + 1}: ${match.context.after}\n`;
        }
        content += '```\n\n';
      });
    });
  }

  const blob = new Blob([content], {
    type: format === 'txt' ? 'text/plain' : 'text/markdown'
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `search_results_${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};