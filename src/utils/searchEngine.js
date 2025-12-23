// 搜索引擎核心逻辑
export const searchInFiles = async (files, searchOptions) => {
  const { query, caseSensitive, wholeWord, useRegex } = searchOptions;
  const startTime = Date.now();
  
  let searchRegex;
  try {
    if (useRegex) {
      searchRegex = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } else {
      // 转义特殊字符
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
      searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    }
  } catch (error) {
    throw new Error(`无效的正则表达式: ${error.message}`);
  }

  const results = {
    query,
    options: searchOptions,
    totalFiles: files.length,
    matchedFiles: 0,
    totalMatches: 0,
    files: [],
    executionTime: 0,
  };

  // 并行处理文件（但限制并发数以避免内存问题）
  const concurrencyLimit = 4;
  const chunks = [];
  for (let i = 0; i < files.length; i += concurrencyLimit) {
    chunks.push(files.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(file => searchInSingleFile(file, searchRegex))
    );
    
    chunkResults.forEach(fileResult => {
      if (fileResult.matches.length > 0) {
        results.matchedFiles++;
        results.totalMatches += fileResult.matches.length;
        results.files.push(fileResult);
      }
    });
  }

  results.executionTime = Date.now() - startTime;
  return results;
};

const searchInSingleFile = async (file, searchRegex) => {
  const result = {
    path: file.path,
    name: file.name,
    matches: [],
  };

  try {
    // 获取文件统计信息以判断文件大小
    const stats = await window.electronAPI.getFileStats(file.path);
    const isLargeFile = stats.size > 10 * 1024 * 1024; // 10MB

    if (isLargeFile) {
      // 大文件使用流式读取
      await searchLargeFile(file, searchRegex, result);
    } else {
      // 小文件直接读取
      await searchSmallFile(file, searchRegex, result);
    }
  } catch (error) {
    console.error(`Failed to search in file ${file.path}:`, error);
  }

  return result;
};

// 小文件搜索
const searchSmallFile = async (file, searchRegex, result) => {
  const { content } = await window.electronAPI.readFile(file.path);
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const matches = [];
    let match;
    
    // 重置正则表达式的 lastIndex
    searchRegex.lastIndex = 0;
    
    while ((match = searchRegex.exec(line)) !== null) {
      matches.push({
        text: match[0],
        index: match.index,
      });
    }

    if (matches.length > 0) {
      result.matches.push({
        lineNumber: index + 1,
        line: line,
        matches: matches,
        context: {
          before: index > 0 ? lines[index - 1] : null,
          after: index < lines.length - 1 ? lines[index + 1] : null,
        },
      });
    }
  });
};

// 大文件流式搜索
const searchLargeFile = async (file, searchRegex, result) => {
  // 这里需要实现流式读取逻辑
  // 由于浏览器环境的限制，我们使用分块读取的方式
  const CHUNK_SIZE = 64 * 1024; // 64KB chunks
  const { content } = await window.electronAPI.readFile(file.path);
  
  // 按行分割内容
  const lines = content.split('\n');
  const maxMatches = 1000; // 限制大文件的匹配数量以避免内存问题
  
  lines.forEach((line, index) => {
    if (result.matches.length >= maxMatches) return;
    
    const matches = [];
    let match;
    
    // 重置正则表达式的 lastIndex
    searchRegex.lastIndex = 0;
    
    while ((match = searchRegex.exec(line)) !== null) {
      matches.push({
        text: match[0],
        index: match.index,
      });
    }

    if (matches.length > 0) {
      result.matches.push({
        lineNumber: index + 1,
        line: line,
        matches: matches,
        context: {
          before: index > 0 ? lines[index - 1] : null,
          after: index < lines.length - 1 ? lines[index + 1] : null,
        },
      });
    }
  });
  
  if (result.matches.length >= maxMatches) {
    result.matches.push({
      lineNumber: -1,
      line: `... 搜索结果已限制为前 ${maxMatches} 个匹配项，以节省内存 ...`,
      matches: [],
      context: null,
      isLimitWarning: true,
    });
  }
};

// 导出搜索结果
export const exportResults = (results, format = 'txt') => {
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
        content += `行 ${match.lineNumber}:\n`;
        if (match.context.before) {
          content += `  ${match.lineNumber - 1}: ${match.context.before}\n`;
        }
        content += `> ${match.lineNumber}: ${match.line}\n`;
        if (match.context.after) {
          content += `  ${match.lineNumber + 1}: ${match.context.after}\n`;
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
        content += `### 行 ${match.lineNumber}\n\n`;
        content += '```text\n';
        if (match.context.before) {
          content += `${match.lineNumber - 1}: ${match.context.before}\n`;
        }
        content += `${match.lineNumber}: ${match.line}\n`;
        if (match.context.after) {
          content += `${match.lineNumber + 1}: ${match.context.after}\n`;
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