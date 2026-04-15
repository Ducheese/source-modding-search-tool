/**
 * 将一个流式 chunk 解析进消息对象，支持  —

<think\>...<\/think\> 标签。
 *
 * 实现为状态机，有两种 mode：'text' | 'think'。
 * 遇到不完整的标签前缀时（如 "<thi"），停止处理并将剩余存入 buffer 等下一个 chunk。
 *
 * 优化点：先用 indexOf('<') 跳过纯文本段，避免逐字符迭代（对长思考链有 5~10x 加速）。
 */

const OPEN  = '<think>';
const CLOSE = '</think>';

/**
 * 解析流式 chunk，支持 <think\>...</think\> 标签
 * @param {Object} message - 当前消息对象
 * @param {string} message.content - 已解析的正文内容
 * @param {string} message.thinkContent - 已解析的思考内容
 * @param {string} message.parseMode - 当前解析模式 'text' | 'think'
 * @param {string} message.parseBuffer - 未处理的缓冲区
 * @param {string} chunk - 新的文本片段
 * @returns {Object} 更新后的消息对象
 */
export const parseThinkChunk = (message, chunk) => {
  const state = {
    content:      message.content      || '',
    thinkContent: message.thinkContent || '',
    mode:         message.parseMode    || 'text',
  };

  let buffer = (message.parseBuffer || '') + chunk;
  let index  = 0;

  while (index < buffer.length) {
    // 跳跃优化：找到下一个 '<' 之前的文本一次性追加
    const nextAngle = buffer.indexOf('<', index);
    if (nextAngle === -1) {
      // 剩余全是普通文本
      const tail = buffer.slice(index);
      if (state.mode === 'think') state.thinkContent += tail;
      else                        state.content      += tail;
      index = buffer.length;
      break;
    }

    // 把 [index, nextAngle) 的普通文本先追加
    if (nextAngle > index) {
      const plain = buffer.slice(index, nextAngle);
      if (state.mode === 'think') state.thinkContent += plain;
      else                        state.content      += plain;
      index = nextAngle;
    }

    // 现在 index 指向 '<'，处理可能的标签
    const remaining = buffer.slice(index);
    if (remaining.startsWith(OPEN)) {
      state.mode = 'think';
      index += OPEN.length;
    } else if (remaining.startsWith(CLOSE)) {
      state.mode = 'text';
      index += CLOSE.length;
    } else if (OPEN.startsWith(remaining) || CLOSE.startsWith(remaining)) {
      // 不完整的标签前缀，停下来等下一个 chunk
      break;
    } else {
      // 普通的 '<'（如 HTML 实体、数学公式等）
      if (state.mode === 'think') state.thinkContent += '<';
      else                        state.content      += '<';
      index += 1;
    }
  }

  return {
    ...message,
    content:      state.content,
    thinkContent: state.thinkContent,
    parseMode:    state.mode,
    parseBuffer:  buffer.slice(index),
  };
};
