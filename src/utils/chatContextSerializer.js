/**
 * AI 上下文序列化工具
 * 
 * 与导出格式 分离：
 * - 导出：给人看的，本地化、可读、漂亮
 * - AI 上下文：给模型吃的，稳定、紧凑、固定语言
 */

/**
 * 将搜索结果序列化为 AI 可理解的上下文格式
 * 固定使用英文标签，不受 UI 语言影响
 * @param {Object} results - 搜索结果对象
 * @param {string} results.query - 搜索查询
 * @param {Array} results.files - 文件结果数组
 * @returns {string} 序列化后的上下文文本
 */
export function serializeResultsForAi(results) {
  if (!results?.files?.length) {
    return 'No search results available.';
  }

  const queryInfo = results.query 
    ? `Search Query: "${results.query}"\n\n` 
    : '';

  const filesText = results.files.map(file => {
    const matchesText = file.matches.map(match => {
      const lineText = formatMatchLine(match);
      const contextText = formatContext(match.context);
      
      return `Line ${match.line_number}: ${lineText}${contextText}`;
    }).join('\n');
    
    return `### ${file.path}\n${matchesText}`;
  }).join('\n\n');

  return queryInfo + filesText;
}

/**
 * 格式化单行匹配（从 segments 中提取文本）
 * @param {Object} match - 匹配对象
 * @returns {string}
 */
function formatMatchLine(match) {
  if (match.segments) {
    return match.segments.map(seg => seg.text).join('');
  }
  // 兼容旧格式
  return match.line || '';
}

/**
 * 格式化上下文行
 * @param {Object} context - 上下文对象 { before: [], after: [] }
 * @returns {string}
 */
function formatContext(context) {
  if (!context) return '';
  
  const parts = [];
  
  if (context.before?.length) {
    const beforeLines = context.before.map((line, i) => 
      `  L-${context.before.length - i}: ${line}`
    ).join('\n');
    parts.push(beforeLines);
  }
  
  if (context.after?.length) {
    const afterLines = context.after.map((line, i) => 
      `  L+${i + 1}: ${line}`
    ).join('\n');
    parts.push(afterLines);
  }
  
  if (parts.length === 0) return '';
  return '\n' + parts.join('\n');
}

/**
 * 估算上下文的 token 数量（粗略估计）
 * @param {string} text - 文本
 * @returns {number} 估算的 token 数
 */
export function estimateTokenCount(text) {
  if (!text) return 0;
  // 粗略估计：英文约 4 字符 = 1 token，中文约 1.5 字符 = 1 token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}
