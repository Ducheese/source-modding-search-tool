use crate::utils::{build_pattern_set, decode_text, is_binary, MAX_MATCHES_PER_FILE};
use memmap2::Mmap;
use rayon::prelude::*;
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::Path;

// ========== 结构体定义 ==========

#[derive(Serialize, Clone)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub matches: Vec<MatchItem>,
}

#[derive(Serialize, Clone)]
pub struct SearchResponse {
    pub files: Vec<SearchResult>,
    pub filtered_file_count: usize,
}

#[derive(Serialize, Clone)]
pub struct MatchItem {
    pub line_number: usize,
    pub segments: Vec<Segment>,
    pub context: MatchContext,
}

#[derive(Serialize, Clone)]
pub struct MatchContext {
    pub before: Vec<String>,
    pub after: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct Segment {
    pub text: String,
    pub is_match: bool,
}

fn default_context_lines() -> usize {
    1
}

#[derive(Deserialize)]
pub struct SearchOptions {
    pub query: String,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub use_regex: bool,
    pub include_pattern: String,
    pub exclude_pattern: String,
    #[serde(default = "default_context_lines")]
    pub context_lines: usize,
}

// ========== 辅助函数 ==========

/// 移除行尾的 \r（处理 Windows 换行格式）
/// Windows 使用 \r\n 换行，Unix 使用 \n，Mac 使用 \r
/// 我们统一移除行尾的 \r，保留 \n 作为换行符
fn trim_trailing_cr(s: &str) -> &str {
    s.strip_suffix('\r').unwrap_or(s)
}

/// 根据字节位置计算行号索引（使用二分查找，O(log N) 时间复杂度）
/// newlines: 换行符字节位置数组（已排序）
/// pos: 要查找的字节位置
/// 返回：行号对应的索引（0-based）
fn line_index_from_pos(newlines: &[usize], pos: usize) -> usize {
    match newlines.binary_search(&pos) {
        Ok(i) => i,        // 匹配点正好在换行符上（通常不会发生）
        Err(i) => i,       // 换行符的插入位置，即行号索引
    }
}

/// 获取指定行的字节范围 [start, end)
/// newlines: 换行符字节位置数组
/// text_len: 文本总字节数
/// line_idx: 行号索引（0-based）
/// 返回：(行起始字节位置, 行结束字节位置)
fn line_range(newlines: &[usize], text_len: usize, line_idx: usize) -> (usize, usize) {
    let start = if line_idx == 0 { 0 } else { newlines[line_idx - 1] + 1 };
    let end = if line_idx < newlines.len() { newlines[line_idx] } else { text_len };
    (start, end)
}

/// 获取指定行的文本（已移除行尾 \r）
/// text: 完整文本内容（&str）
/// newlines: 换行符字节位置数组
/// line_idx: 行号索引（0-based）
/// 返回：该行的文本内容（不包含行尾换行符）
fn get_line_text<'a>(text: &'a str, newlines: &[usize], line_idx: usize) -> &'a str {
    let (start, end) = line_range(newlines, text.len(), line_idx);
    trim_trailing_cr(&text[start..end])
}

// ========== Tauri 命令 ==========

/// 核心：基于 Mmap 和纯文本正则的搜索
#[tauri::command]
pub async fn search_in_files(
    files: Vec<String>,
    options: SearchOptions,
) -> Result<SearchResponse, String> {
    
    // 第一步：构建包含/排除规则
    let include_set = build_pattern_set(&options.include_pattern)?;
    let exclude_set = build_pattern_set(&options.exclude_pattern)?;

    // 第二步：并行过滤文件
    let target_files: Vec<String> = files
        .into_par_iter()
        .filter(|path_str| {
            let path = Path::new(path_str);
            
            // 排除规则优先级更高
            if let Some(exclude) = &exclude_set {
                if exclude.is_match(path) {
                    return false;
                }
            }
            
            // 包含规则检查（如果设置了的话）
            if let Some(include) = &include_set {
                if !include.is_match(path) {
                    return false;
                }
            }
            
            true
        })
        .collect();

    let filtered_file_count = target_files.len();

    // 第三步：构造正则表达式模式
    let pattern = if options.use_regex {
        options.query.clone()             // 用户输入的正则表达式直接使用
    } else {
        regex::escape(&options.query)     // 普通文本需要转义正则特殊字符
    };

    let final_pattern = if options.whole_word && !options.use_regex {
        format!(r"\b{}\b", pattern)       // 整词匹配：添加单词边界
    } else {
        pattern
    };

    // 第四步：构建纯文本正则引擎
    // regex::RegexBuilder 与 regex::bytes::RegexBuilder 性能相当
    // 但 regex::Regex 保证返回的偏移量是 UTF-8 安全的，可以直接用于切片 &str
    let re = RegexBuilder::new(&final_pattern)
        .case_insensitive(!options.case_sensitive)     // 大小写不敏感
        .multi_line(options.use_regex)                 // 多行模式：^$ 匹配行首行尾
        .unicode(true)                                 // Unicode 支持：正确处理中文、emoji 等
        .build()
        .map_err(|e| format!("无效的正则表达式: {}", e))?;

    let context_lines = options.context_lines;

    // 第五步：并行搜索每个文件
    let results: Vec<SearchResult> = target_files
        .par_iter()
        .filter_map(|path_str| {
            let path = Path::new(path_str);
            
            // 使用内存映射（Mmap）提高文件读取性能
            let file = File::open(path).ok()?;
            let mmap = unsafe { Mmap::map(&file) }.ok()?;

            // 跳过二进制文件
            if is_binary(&mmap) {
                return None;
            }

            // 解码文件：BOM优先 -> UTF-8严格校验 -> chardetng兜底
            let (content_cow, _encoding) = decode_text(&mmap);
            let content = content_cow.as_ref();

            if content.is_empty() {
                return None;
            }

            // 构建换行符索引（用于快速行号定位）
            // '\n' 是 ASCII 单字节，在 UTF-8 中字节位置是安全的
            let newline_indices: Vec<usize> = content
                .as_bytes()
                .iter()
                .enumerate()
                .filter_map(|(i, &b)| if b == b'\n' { Some(i) } else { None })
                .collect();

            let total_lines = newline_indices.len() + 1;
            let mut matches: Vec<MatchItem> = Vec::new();
            let mut last_line_number: Option<usize> = None;

            // 在 &str 上执行正则搜索
            // regex::Regex.find_iter() 返回的 Match 对象包含 UTF-8 安全的字节偏移
            for mat in re.find_iter(content) {
                if matches.len() >= MAX_MATCHES_PER_FILE {
                    break;
                }
                
                // 使用二分查找快速确定匹配所在的行（O(log N) 时间复杂度）
                let line_idx = line_index_from_pos(&newline_indices, mat.start());
                let line_number = line_idx + 1;

                // 同一行只添加一次，避免重复（前端会展示该行所有高亮）
                if last_line_number == Some(line_number) {
                    continue;
                }
                last_line_number = Some(line_number);

                // 获取当前行的文本内容
                let line_text = get_line_text(content, &newline_indices, line_idx);

                // 对当前行重新运行正则，切出高亮片段
                let mut segments = Vec::new();
                let mut last_idx = 0;

                // 在行文本上查找所有匹配项
                for m in re.find_iter(line_text) {
                    // 添加匹配前的普通文本
                    if m.start() > last_idx {
                        segments.push(Segment {
                            text: line_text[last_idx..m.start()].to_string(),
                            is_match: false,
                        });
                    }
                    
                    // 添加匹配文本（高亮部分）
                    segments.push(Segment {
                        text: line_text[m.start()..m.end()].to_string(),
                        is_match: true,
                    });

                    last_idx = m.end();
                }
                
                // 添加剩余文本
                if last_idx < line_text.len() {
                    segments.push(Segment {
                        text: line_text[last_idx..].to_string(),
                        is_match: false,
                    });
                }

                // 防止跨行正则导致本行没有匹配项时，整行为空（卵用没有）
                if segments.is_empty() {
                    segments.push(Segment {
                        text: line_text.to_string(),
                        is_match: false,
                    });
                }

                // 提取上下文行（前后若干行）
                let mut before = Vec::new();  // 前面的行
                let mut after = Vec::new();   // 后面的行

                // 提取前面的上下文行
                for offset in (1..=context_lines).rev() {
                    if line_idx >= offset {
                        before.push(get_line_text(content, &newline_indices, line_idx - offset).to_string());
                    }
                }

                // 提取后面的上下文行
                for offset in 1..=context_lines {
                    let target_idx = line_idx + offset;
                    if target_idx < total_lines {
                        after.push(get_line_text(content, &newline_indices, target_idx).to_string());
                    }
                }

                // 添加到结果列表
                matches.push(MatchItem {
                    line_number,
                    segments,     // 已切分好的高亮片段
                    context: MatchContext { before, after },
                });
            }

            // 返回搜索结果（如果没有匹配项返回 None）
            if matches.is_empty() {
                None
            } else {
                Some(SearchResult {
                    path: path_str.clone(),
                    name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                    matches,
                })
            }
        })
        .collect();
    
    // 返回完整的搜索响应
    Ok(SearchResponse {
        files: results,
        filtered_file_count,
    })
}
