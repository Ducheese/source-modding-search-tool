/**
 * AI 上下文序列化工具
 * 
 * 与导出格式 分离：
 * - 导出：给人看的，本地化、可读、漂亮
 * - AI 上下文：给模型吃的，稳定、紧凑、固定语言
 */

import { Tiktoken } from 'js-tiktoken/lite';
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';

// 缓存 encoder 实例，避免重复创建
let encoder = null;

function getEncoder() {
  if (!encoder) {
    encoder = new Tiktoken(cl100k_base);
  }
  return encoder;
}

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
 * 精确计算文本的 token 数量
 * 使用 cl100k_base 编码（GPT-4、GPT-3.5-turbo 等模型通用）
 * @param {string} text - 文本
 * @returns {number} token 数量
 */
export function estimateTokenCount(text) {
  if (!text) return 0;
  try {
    const enc = getEncoder();
    // +4 是消息格式开销（每条消息的 role/content 边界）
    return enc.encode(text).length + 4;
  } catch {
    // 异常时回退到粗略估算
    return Math.ceil(text.length / 4) + 4;
  }
}
