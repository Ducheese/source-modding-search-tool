/**
 * vdfParser.js
 *
 * 解析 Valve VDF KeyValues 格式的 lang 文件，格式约定如下：
 *
 *   "lang"
 *   {
 *     "Language"  "schinese"
 *     "Tokens"
 *     {
 *       "key"  "value"
 *     }
 *   }
 *
 * 支持：
 *   - // 行注释（行内、整行均可）
 *   - \" 转义引号
 *   - 嵌套对象（任意深度）
 *   - \t / 空格分隔的键值对
 *
 * 返回：外层 "lang" 块展开后的对象，即 { Language, Tokens: { key: value, ... } }
 * 若解析失败则返回空对象 {}
 */
export function parseVdf(text) {
  if (!text) return {};

  // 1. 去除行注释（保留换行，保留引号内的 //）
  //    策略：逐字符扫描，跳过引号内内容
  let stripped = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      stripped += ch;
      if (ch === '\\' && i + 1 < text.length) {
        // 转义字符，跳过下一个
        stripped += text[++i];
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
        stripped += ch;
      } else if (ch === '/' && text[i + 1] === '/') {
        // 跳到行尾
        while (i < text.length && text[i] !== '\n') i++;
      } else {
        stripped += ch;
      }
    }
  }

  // 2. Tokenize：提取引号字符串和花括号
  const tokens = [];
  const re = /"((?:[^"\\]|\\.)*)"|([{}])/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    if (m[1] !== undefined) {
      // 解析转义序列（仅处理 \" 和 \\）
      const value = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      tokens.push({ type: 'str', value });
    } else {
      tokens.push({ type: 'brace', value: m[2] });
    }
  }

  // 3. 递归解析对象块（调用时 pos 指向 { 之后的第一个 token）
  let pos = 0;

  function parseBlock() {
    const obj = {};
    while (pos < tokens.length) {
      const tok = tokens[pos];

      // 块结束
      if (tok.type === 'brace' && tok.value === '}') {
        pos++;
        break;
      }

      // 键
      if (tok.type === 'str') {
        const key = tok.value;
        pos++;

        if (pos < tokens.length) {
          const next = tokens[pos];
          if (next.type === 'str') {
            // 键 = 字符串值
            obj[key] = next.value;
            pos++;
          } else if (next.type === 'brace' && next.value === '{') {
            // 键 = 嵌套对象
            pos++;
            obj[key] = parseBlock();
          }
          // 其他情况（理论上不会出现）跳过
        }
      } else {
        // 意外 token，跳过
        pos++;
      }
    }
    return obj;
  }

  // 4. 期望顶层格式：<string> { ... }
  //    外层字符串（通常是 "lang"）作为根 key，直接展开其内容
  if (
    tokens.length >= 3 &&
    tokens[0].type === 'str' &&
    tokens[1].type === 'brace' &&
    tokens[1].value === '{'
  ) {
    pos = 2;
    return parseBlock();
  }

  return {};
}
