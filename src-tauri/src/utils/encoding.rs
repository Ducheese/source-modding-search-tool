use std::borrow::Cow;
use crate::utils::{ENCODING_DETECT_WINDOW, BINARY_DETECT_WINDOW};

/// 解码文件内容：BOM优先 -> UTF-8严格校验 -> chardetng兜底
/// 这是整个搜索流程的关键第一步：正确解码文件内容
/// 返回：文本内容（Cow<'_, str> 避免不必要的内存分配）和编码名称
pub fn decode_text(bytes: &[u8]) -> (Cow<'_, str>, String) {
    // 1. 检查 BOM（Byte Order Mark）
    // UTF-8 BOM: EF BB BF
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        // UTF-8 BOM - 跳过 BOM，直接解析剩余内容
        let text = std::str::from_utf8(&bytes[3..]).unwrap_or("");
        return (Cow::Owned(text.to_string()), "UTF-8-BOM".to_string());
    }
    // UTF-16 LE BOM: FF FE（排除 UTF-32 LE，后者由 chardetng 处理）
    else if bytes.starts_with(&[0xFF, 0xFE]) && !bytes.starts_with(&[0xFF, 0xFE, 0x00, 0x00]) {
        let encoding = encoding_rs::UTF_16LE;
        let (cow, _, _) = encoding.decode(bytes);
        return (cow, "UTF-16LE".to_string());
    }
    // UTF-16 BE BOM: FE FF
    else if bytes.starts_with(&[0xFE, 0xFF]) {
        let encoding = encoding_rs::UTF_16BE;
        let (cow, _, _) = encoding.decode(bytes);
        return (cow, "UTF-16BE".to_string());
    }

    // 2. 尝试严格 UTF-8 解码（零拷贝，最高效）
    // 如果文件已经是 UTF-8，直接返回借用，避免内存分配
    if let Ok(s) = std::str::from_utf8(bytes) {
        return (Cow::Borrowed(s), "UTF-8".to_string());
    }

    // 3. chardetng 兜底（可处理 UTF-32、GBK、Shift-JIS、EUC-JP 等各种编码）
    // 只扫描文件头部 8KB，保证性能
    let mut detector = chardetng::EncodingDetector::new();
    let head_len = bytes.len().min(ENCODING_DETECT_WINDOW);
    detector.feed(&bytes[..head_len], true);
    let encoding = detector.guess(None, true);
    let (cow, _, _) = encoding.decode(bytes);
    (cow, encoding.name().to_string())
}

/// 辅助：快速判断是不是二进制，只读前 8KB
pub fn is_binary(data: &[u8]) -> bool {
    let len = data.len().min(BINARY_DETECT_WINDOW);
    content_inspector::inspect(&data[..len]).is_binary()
}
