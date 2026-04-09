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
    throw new Error(`Search failed: ${error}`);
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
export const formatResultsForExport = (results, format = 'txt', t = null) => {
  // Helper: use t() if available, otherwise use the fallback string
  const s = (key, fallback) => (t ? t(key) : fallback);
  if (!results || results.files.length === 0) {
    throw new Error(s('export.noResults', 'No search results to export'));
  }

  // --- 新增辅助函数：把 segments 还原回纯文本 ---
  const getLineText = (segments) => {
    if (!segments) return '';
    return segments.map(s => s.text).join('');
  };

  let content = '';
  const timestamp = new Date().toLocaleString();

  if (format === 'txt') {
    content = `${s('export.title', 'Search Results Export')}\n`;
    content += `================\n\n`;
    content += `${s('export.query', 'Query')}: ${results.query}\n`;
    content += `${s('export.options', 'Options')}: ${JSON.stringify(results.options, null, 2)}\n`;
    content += `${s('export.time', 'Exported at')}: ${timestamp}\n\n`;
    content += `${s('export.stats', 'Statistics')}:\n`;
    content += `- ${s('export.totalFiles', 'Total files')}: ${results.totalFiles}\n`;
    content += `- ${s('export.matchedFiles', 'Matched files')}: ${results.matchedFiles}\n`;
    content += `- ${s('export.totalMatches', 'Matched lines')}: ${results.totalMatches}\n`;
    content += `- ${s('export.execTime', 'Time')}: ${results.executionTime}ms\n\n`;

    results.files.forEach(file => {
      content += `${s('export.file', 'File')}: ${file.path}\n`;
      content += `${'='.repeat(file.path.length + 4)}\n\n`;

      file.matches.forEach(match => {
        content += `${s('export.line', 'Line')} ${match.line_number}:\n`; // 注意：Rust返回的是 snake_case
        if (match.context.before && match.context.before.length > 0) {
          const startLine = match.line_number - match.context.before.length;
          match.context.before.forEach((line, idx) => {
            content += `  ${startLine + idx}: ${line}\n`;
          });
        }
        // --- 修复点：使用 getLineText 替代 match.line ---
        content += `> ${match.line_number}: ${getLineText(match.segments)}\n`;
        if (match.context.after && match.context.after.length > 0) {
          match.context.after.forEach((line, idx) => {
            content += `  ${match.line_number + 1 + idx}: ${line}\n`;
          });
        }
        content += '\n';
      });

      content += '\n';
    });
  } else if (format === 'md') {
    content = `# ${s('export.title', 'Search Results Export')}\n\n`;
    content += `**${s('export.query', 'Query')}:** \`${results.query}\`\n\n`;
    content += `**${s('export.options', 'Options')}:**\n\`\`\`json\n${JSON.stringify(results.options, null, 2)}\n\`\`\`\n\n`;
    content += `**${s('export.time', 'Exported at')}:** ${timestamp}\n\n`;
    content += `## ${s('export.stats', 'Statistics')}\n\n`;
    content += `- ${s('export.totalFiles', 'Total files')}: ${results.totalFiles}\n`;
    content += `- ${s('export.matchedFiles', 'Matched files')}: ${results.matchedFiles}\n`;
    content += `- ${s('export.totalMatches', 'Matched lines')}: ${results.totalMatches}\n`;
    content += `- ${s('export.execTime', 'Time')}: ${results.executionTime}ms\n\n`;

    results.files.forEach(file => {
      content += `## ${file.name}\n\n`;
      content += `**${s('export.path', 'Path')}:** \`${file.path}\`\n\n`;

      file.matches.forEach(match => {
        content += `### ${s('export.line', 'Line')} ${match.line_number}\n\n`;
        content += '```text\n';
        if (match.context.before && match.context.before.length > 0) {
          const startLine = match.line_number - match.context.before.length;
          match.context.before.forEach((line, idx) => {
            content += `${startLine + idx}: ${line}\n`;
          });
        }
        // --- 修复点：使用 getLineText 替代 match.line ---
        content += `${match.line_number}: ${getLineText(match.segments)}\n`;
        if (match.context.after && match.context.after.length > 0) {
          match.context.after.forEach((line, idx) => {
            content += `${match.line_number + 1 + idx}: ${line}\n`;
          });
        }
        content += '```\n\n';
      });
    });
  }

  return content;
};

export const exportResults = (results, format = 'txt', t = null) => {
  const s = (key, fallback) => (t ? t(key) : fallback);
  const content = formatResultsForExport(results, format, t);
  if (!content) {
    throw new Error(s('export.noResults', 'No search results to export'));
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
