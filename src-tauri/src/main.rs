#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rayon::prelude::*;
use regex::RegexBuilder; // 纯文本正则，性能与 bytes 版本相当，但保证 UTF-8 边界安全
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use walkdir::WalkDir;
use memmap2::Mmap; // 引入内存映射
use globset::{GlobSet, GlobSetBuilder}; // 【新神语】召唤真神的三位一体
use tauri::Manager; // 单例模式，阻止窗口重复打开
use reqwest::Client;
use futures_util::StreamExt;
use std::time::Duration;
use anyhow::{bail, ensure, Context};
use once_cell::sync::Lazy;
use url::Url;
use log::{info, error};

// 保持结构体不变，方便你前端不用改太多
#[derive(Serialize, Clone)]
struct FileStats {
    size: u64,
    lines: usize,
    encoding: String, // 仍然保留，但我们会用更聪明的方式检测
    path: String,
    name: String,
}

// 搜索结果结构体
#[derive(Serialize, Clone)]
struct SearchResult {
    path: String,
    name: String,
    matches: Vec<MatchItem>,
}

// 搜索响应结构体，包含结果和统计信息
#[derive(Serialize, Clone)]
struct SearchResponse {
    files: Vec<SearchResult>,
    filtered_file_count: usize, // 过滤后实际参与搜索的文件数
}

#[derive(Serialize, Clone)]
struct MatchItem {
    line_number: usize,
    segments: Vec<Segment>, // 核心变动：不再只是 line: String，而是直接切好的片段
    context: MatchContext,
}

#[derive(Serialize, Clone)]
struct MatchContext {
    before: Vec<String>,
    after: Vec<String>,
}

// 新增片段结构体
#[derive(Serialize, Clone)]
struct Segment {
    text: String,
    is_match: bool,
}

fn default_context_lines() -> usize {
    1
}

#[derive(Deserialize)]
struct SearchOptions {
    query: String,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
    include_pattern: String,
    exclude_pattern: String,
    #[serde(default = "default_context_lines")]
    context_lines: usize,
}

#[derive(Deserialize)]
struct AiRegexRequest {
    user_prompt: String,
    system_prompt: String,
    api_key: String,
    base_url: String,
    model_name: String,
}

#[derive(Deserialize)]
struct AiChatMessage {
    role: String,
    content: String,
}
fn default_enable_thinking() -> bool { false }

fn default_thinking_budget() -> u16 { 4096 }

#[derive(Deserialize)]
struct AiChatStreamRequest {
    messages: Vec<AiChatMessage>,
    api_key: String,
    base_url: String,
    model_name: String,
    request_id: String,
    #[serde(default = "default_enable_thinking")]
    enable_thinking: bool,
    #[serde(default = "default_thinking_budget")]
    thinking_budget: u16,
}

#[derive(Serialize)]
struct AiRegexResponse {
    regex: String,
}

// 通用反馈结构体 - 支持多种反馈类型
// type: "translation" | "bug" | "feature" | ...
// data: 具体反馈内容（根据 type 不同而变化）
#[derive(Deserialize, Serialize, Clone)]
struct Feedback {
    #[serde(rename = "type")]  // 前端字段名为 type，Rust 映射到 feedback_type
    feedback_type: String,
    #[serde(rename = "contributor", default)]
    contributor_nickname: Option<String>,
    data: serde_json::Value,    // 使用 Value 支持任意 JSON 结构
    timestamp: String,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
}

#[derive(Deserialize)]
struct OpenAiMessage {
    content: Option<String>,
}

fn normalize_base_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return String::new();
    }
    
    // 如果已经是完整的 /v1/chat/completions 端点
    if trimmed.ends_with("/v1/chat/completions") {
        // 去掉 /chat/completions 部分，只保留 /v1
        let without_completions = &trimmed[..trimmed.len() - "/chat/completions".len()];
        return without_completions.to_string();
    }
    
    // 如果已经是 /v1 结尾，保持不变
    if trimmed.ends_with("/v1") {
        return trimmed.to_string();
    }
    
    // 其他情况添加 /v1
    format!("{trimmed}/v1")
}

// 提取 host 用于判断提供商
// 使用标准库 url::Url 正确解析，避免手写字符串操作的潜在 bug
// 支持带认证信息、IPv6、非标准路径等各种 URL 格式
fn extract_host(base_url: &str) -> String {
    Url::parse(base_url)
        .ok()
        .and_then(|url| url.host_str().map(|s| s.to_lowercase()))
        .unwrap_or_default()
}

// 根据提供商生成推理参数
fn get_reasoning_params(base_url: &str, enable_thinking: bool, thinking_budget: u16) -> serde_json::Value {
    let host = extract_host(base_url);
    
    match host.as_str() {
        // OpenRouter: 使用 reasoning 对象
        h if h.contains("openrouter.ai") => {
            if enable_thinking {
                json!({
                    "reasoning": {
                        "max_tokens": thinking_budget
                    }
                })
            } else {
                json!({})
            }
        }
        
        // DeepSeek / 硅基流动: 使用 enable_thinking + thinking_budget
        h if h.contains("api.siliconflow.cn") || h.contains("api.deepseek.com") => {
            json!({
                "enable_thinking": enable_thinking,
                "thinking_budget": if enable_thinking { thinking_budget } else { 0 }
            })
        }
        
        // 豆包 (火山): 使用 thinking.type
        h if h.contains("ark.cn-beijing.volces.com") || h.contains("ark.cn-beijing.volcengineapi.com") => {
            json!({
                "thinking": {
                    "type": if enable_thinking { "enabled" } else { "disabled" }
                }
            })
        }
        
        // 阿里云百炼: 使用 enable_thinking + thinking_budget
        h if h.contains("dashscope.aliyuncs.com") => {
            json!({
                "enable_thinking": enable_thinking,
                "thinking_budget": if enable_thinking { thinking_budget } else { 0 }
            })
        }
        
        // 默认使用 OpenRouter 格式（兼容性最好）
        _ => {
            if enable_thinking {
                json!({
                    "reasoning": {
                        "max_tokens": thinking_budget
                    }
                })
            } else {
                json!({})
            }
        }
    }
}

// 用于 AI 写正则 / 解释正则：响应快，超时短
static HTTP_CLIENT: Lazy<anyhow::Result<Client>> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(5))
        .build()
        .context("创建HTTP客户端失败")
});

// 用于流式对话：输出可能较长，超时宽松
static STREAM_HTTP_CLIENT: Lazy<anyhow::Result<Client>> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(180))
        .connect_timeout(Duration::from_secs(5))
        .build()
        .context("创建HTTP客户端失败")
});

fn get_http_client() -> anyhow::Result<&'static Client> {
    HTTP_CLIENT.as_ref().map_err(|e| anyhow::anyhow!("{}", e))
}

fn get_stream_http_client() -> anyhow::Result<&'static Client> {
    STREAM_HTTP_CLIENT.as_ref().map_err(|e| anyhow::anyhow!("{}", e))
}

// 去掉多余的考虑情况，感觉意义不大
fn extract_regex_from_text(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // 处理代码块格式（有去除语言标识符，如 `regex:`）
    if let (Some(start), Some(end)) = (trimmed.find("```"), trimmed.rfind("```")) {
        if end > start + 3 {
            let mut inner = trimmed[start + 3..end].trim().to_string();
            if let Some(first_line_end) = inner.find('\n') {
                let first_line = inner[..first_line_end].trim();
                let maybe_lang = first_line.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_');
                if maybe_lang {
                    inner = inner[first_line_end + 1..].trim().to_string();
                }
            }
            return inner.trim().to_string();
        }
    }

    // 处理引号包围格式
    if (trimmed.starts_with('"') && trimmed.ends_with('"'))
        || (trimmed.starts_with('`') && trimmed.ends_with('`'))
    {
        return trimmed[1..trimmed.len() - 1].trim().to_string();
    }

    trimmed.to_string()
}

// sonnet：行业级，没有实质问题。
fn validate_ai_request_common(api_key: &str, base_url: &str, model_name: &str) -> anyhow::Result<String> {
    ensure!(!api_key.trim().is_empty(), "API Key 不能为空。");
    ensure!(!base_url.trim().is_empty(), "API Base Url 不能为空。");
    ensure!(!model_name.trim().is_empty(), "模型名称不能为空。");

    let api_base = normalize_base_url(base_url);
    ensure!(!api_base.is_empty(), "API Base Url 无效。");
    Ok(api_base)
}

// sonnet：整份代码里写得最好的函数，逐条对照 RFC 8895 检验都没问题
fn collect_sse_events(buffer: &mut String) -> Vec<String> {
    let mut events = Vec::new();

    loop {
        let Some(idx) = buffer.find("\n\n") else { break; };
        let raw = buffer[..idx].to_string();
        buffer.drain(..idx + 2);

        let raw = raw.trim();
        if raw.is_empty() {
            continue;
        }

        // collect_sse_events 里的 trim_end() 是作用在 SSE 协议行（data: {...}这整行）上的
        // 去掉的是行尾的 \r，不是 JSON 值内部的内容。这是正确的 SSE 解析行为，不算多余加工。
        let mut data_lines = Vec::new();
        for line in raw.lines() {
            let line = line.trim_end();
            if line.starts_with(':') {
                continue;
            }
            if let Some(rest) = line.strip_prefix("data:") {
                let data = rest.trim_start();
                if !data.is_empty() {
                    data_lines.push(data.to_string());
                }
            }
        }

        if !data_lines.is_empty() {
            events.push(data_lines.join("\n"));
        }
    }

    events
}

// 【重铸完成的辅助函数】构建 Glob 集合
fn build_pattern_set(patterns_str: &str) -> Result<Option<GlobSet>, String> {
    if patterns_str.is_empty() {
        return Ok(None);
    }
    
    // GlobSet 的构建方式不同，它需要一个 Builder
    let mut builder = GlobSetBuilder::new();
    for p in patterns_str.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let processed_pattern = if !p.contains('*') && !p.contains('?') && (p.contains('/') || p.contains('\\')) {
            // 规则 1：处理纯目录路径（如 'vendor/lib'） -> **/vendor/lib/**
            format!("**/{p}/**") 
        } else if !p.contains('/') && !p.contains('\\') {
            // 规则 2：处理纯文件名或扩展名 (如 '*.js' 或 'temp_file') -> **/{p}
            // ⚠️ 注意：这里必须处理 p 已经是通配符的情况，但如果它不含路径分隔符，可以统一处理。
            // 因为 globset 默认已经有 **/* 的效果，但这里显式声明更清晰。
            format!("**/{p}")
        } else {
            // 规则 3：已经是完整的路径模式 (如 'src/**/*.js')，不做修改
            p.to_string()
        };

        // 替换 Glob::new()，使用 GlobBuilder::new() 应用配置
        let glob = globset::GlobBuilder::new(&processed_pattern)
            .case_insensitive(true)        // 这里根据前端选项决定是否忽略大小写
            .literal_separator(false)      // 路径分隔符更加智能/宽松
            .build()                       // 结束配置链，将 GlobBuilder 编译成最终可用的 Glob 结构体
            .map_err(|e| e.to_string())?;
        builder.add(glob);
    }

    builder.build()
        .map(Some)
        .map_err(|e| e.to_string())
}

// 辅助：快速判断是不是二进制，只读前 8KB
fn is_binary(data: &[u8]) -> bool {
    let len = data.len().min(8192);
    content_inspector::inspect(&data[..len]).is_binary()
}

// ========== 纯文本搜索辅助函数 ==========

/// 移除行尾的 \r（处理 Windows 换行）
fn trim_trailing_cr(s: &str) -> &str {
    s.strip_suffix('\r').unwrap_or(s)
}

/// 根据字节位置计算行号索引（二分查找，O(log N)）
fn line_index_from_pos(newlines: &[usize], pos: usize) -> usize {
    match newlines.binary_search(&pos) {
        Ok(i) => i,
        Err(i) => i,
    }
}

/// 获取指定行的字节范围 [start, end)
fn line_range(newlines: &[usize], text_len: usize, line_idx: usize) -> (usize, usize) {
    let start = if line_idx == 0 { 0 } else { newlines[line_idx - 1] + 1 };
    let end = if line_idx < newlines.len() { newlines[line_idx] } else { text_len };
    (start, end)
}

/// 获取指定行的文本（已移除行尾 \r）
fn get_line_text<'a>(text: &'a str, newlines: &[usize], line_idx: usize) -> &'a str {
    let (start, end) = line_range(newlines, text.len(), line_idx);
    trim_trailing_cr(&text[start..end])
}

/// 解码文件内容：BOM优先 -> UTF-8严格校验 -> chardetng兜底
/// 返回 (文本内容, 编码名称)
fn decode_text(bytes: &[u8]) -> (std::borrow::Cow<'_, str>, String) {
    // 1. 检查 BOM（UTF-16 由 chardetng 处理，这里只处理 UTF-8 BOM）
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        // UTF-8 BOM
        let text = std::str::from_utf8(&bytes[3..]).unwrap_or("");
        return (std::borrow::Cow::Owned(text.to_string()), "UTF-8-BOM".to_string());
    } else if bytes.starts_with(&[0xFF, 0xFE]) && !bytes.starts_with(&[0xFF, 0xFE, 0x00, 0x00]) {
        // UTF-16 LE BOM（排除 UTF-32 LE，后者由 chardetng 处理）
        let encoding = encoding_rs::UTF_16LE;
        let (cow, _, _) = encoding.decode(bytes);
        return (cow, "UTF-16LE".to_string());
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        // UTF-16 BE BOM
        let encoding = encoding_rs::UTF_16BE;
        let (cow, _, _) = encoding.decode(bytes);
        return (cow, "UTF-16BE".to_string());
    }

    // 2. 尝试严格 UTF-8 解码（零拷贝）
    if let Ok(s) = std::str::from_utf8(bytes) {
        return (std::borrow::Cow::Borrowed(s), "UTF-8".to_string());
    }

    // 3. chardetng 兜底（可处理 UTF-32、GBK、Shift-JIS 等）
    let mut detector = chardetng::EncodingDetector::new();
    let head_len = bytes.len().min(8192);
    detector.feed(&bytes[..head_len], true);
    let encoding = detector.guess(None, true);
    let (cow, _, _) = encoding.decode(bytes);
    (cow, encoding.name().to_string())
}

// 1. 扫描目录：逻辑不变，但你可以把 FileDropZone.js 里的递归逻辑全移到这
// 只要前端传文件夹路径，这里就负责递归到底
#[tauri::command]
async fn scan_directory(dir_path: String) -> Result<Vec<String>, String> {
    let files: Vec<String> = WalkDir::new(dir_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .map(|e| e.path().to_string_lossy().into_owned())
        .collect();
    Ok(files)
}

// 2. 极速获取文件状态
#[tauri::command]
async fn get_file_stats(file_paths: Vec<String>) -> Result<Vec<FileStats>, String> {
    let stats: Vec<FileStats> = file_paths
        .par_iter()
        .map(|path_str| {
            let path = Path::new(path_str);
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            
            // 打开文件
            let file = match File::open(path) {
                Ok(f) => f,
                Err(_) => return FileStats { size: 0, lines: 0, encoding: "Error".into(), path: path_str.clone(), name },
            };
            
            let metadata = file.metadata().ok();
            let size = metadata.map(|m| m.len()).unwrap_or(0);

            // 如果文件是空的，直接返回
            if size == 0 {
                return FileStats { size: 0, lines: 0, encoding: "Empty".into(), path: path_str.clone(), name };
            }

            // 使用 Mmap，极速！
            let mmap = unsafe { Mmap::map(&file) }
                .with_context(|| format!("无法映射文件: {}", path.display()))
                .ok();
            
            if let Some(mmap) = mmap {
                // 检查二进制
                if is_binary(&mmap) {
                     return FileStats { size, lines: 0, encoding: "Binary".into(), path: path_str.clone(), name };
                }

                // 快速统计行数：并行计算换行符，比 .lines().count() 快几十倍
                let lines = mmap.par_iter().filter(|&&b| b == b'\n').count() + 1;

                // 探测编码（只取头部一部分，不要全量探测）
                let head_len = mmap.len().min(8192); // 8KB
                let mut detector = chardetng::EncodingDetector::new();
                detector.feed(&mmap[..head_len], true);
                let encoding = detector.guess(None, true).name().to_string();

                FileStats { size, lines, encoding, path: path_str.clone(), name }
            } else {
                FileStats { size, lines: 0, encoding: "AccessDenied".into(), path: path_str.clone(), name }
            }
        })
        .collect();

    Ok(stats)
}

// 辅助函数：读取并解码文件，这是从混沌中提取秩序的过程
fn read_file_content(path: &Path) -> anyhow::Result<(String, String)> {
    let mut file = File::open(path)?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;

    // 检查是否为二进制文件，如果是，直接忽略，免得污了我的眼
    if content_inspector::inspect(&buffer).is_binary() {
        return Ok((String::new(), "Binary".to_string()));
    }

    // 使用 chardetng 进行精准的编码探测
    let mut detector = chardetng::EncodingDetector::new();
    detector.feed(&buffer, true);
    let encoding = detector.guess(None, true);
    
    let (cow, _, _) = encoding.decode(&buffer);
    Ok((cow.into_owned(), encoding.name().to_string()))
}

// 3. 读取单个文件内容
#[tauri::command]
async fn read_file(path: String) -> Result<serde_json::Value, String> {
    let path_obj = Path::new(&path);
    match read_file_content(path_obj) {
        Ok((content, encoding)) => Ok(serde_json::json!({
            "content": content,
            "encoding": encoding
        })),
        Err(e) => Err(e.to_string()),
    }
}

// 4. 核心：基于 Mmap 和纯文本正则的搜索
// 关键原则：一旦解码成 &str，后续流程必须是纯文本操作
#[tauri::command]
async fn search_in_files(
    files: Vec<String>,
    options: SearchOptions,
) -> Result<SearchResponse, String> {
    
    let include_set = build_pattern_set(&options.include_pattern)?;
    let exclude_set = build_pattern_set(&options.exclude_pattern)?;

    let target_files: Vec<String> = files
        .into_par_iter()
        .filter(|path_str| {
            let path = Path::new(path_str);
            
            if let Some(exclude) = &exclude_set {
                if exclude.is_match(path) {
                    return false;
                }
            }
            
            if let Some(include) = &include_set {
                if !include.is_match(path) {
                    return false;
                }
            }
            
            true
        })
        .collect();

    let filtered_file_count = target_files.len();

    let pattern = if options.use_regex {
        options.query.clone()
    } else {
        regex::escape(&options.query)
    };

    let final_pattern = if options.whole_word && !options.use_regex {
        format!(r"\b{}\b", pattern)
    } else {
        pattern
    };

    // 使用 regex::RegexBuilder（纯文本正则，性能与 bytes 版本相当）
    let re = RegexBuilder::new(&final_pattern)
        .case_insensitive(!options.case_sensitive)
        .multi_line(options.use_regex)
        .unicode(true)
        .build()
        .map_err(|e| format!("无效的正则表达式: {}", e))?;

    let context_lines = options.context_lines;

    let results: Vec<SearchResult> = target_files
        .par_iter()
        .filter_map(|path_str| {
            let path = Path::new(path_str);
            let file = File::open(path).ok()?;
            let mmap = unsafe { Mmap::map(&file) }
                .with_context(|| format!("无法映射文件: {}", path.display()))
                .ok()?;

            if is_binary(&mmap) {
                return None;
            }

            // 解码：BOM优先 -> UTF-8严格校验 -> chardetng兜底
            let (content_cow, _encoding) = decode_text(&mmap);
            let content = content_cow.as_ref();

            if content.is_empty() {
                return None;
            }

            // 换行符位置索引（'\n' 是 ASCII 单字节，在 UTF-8 中字节位置安全）
            let newline_indices: Vec<usize> = content
                .as_bytes()
                .iter()
                .enumerate()
                .filter_map(|(i, &b)| if b == b'\n' { Some(i) } else { None })
                .collect();

            let total_lines = newline_indices.len() + 1;
            let mut matches: Vec<MatchItem> = Vec::new();
            let mut last_line_number: Option<usize> = None;

            // 在 &str 上搜索，regex::Regex 返回的字节偏移是 UTF-8 安全边界
            for mat in re.find_iter(content) {
                if matches.len() >= 500 {
                    break;
                }

                let line_idx = line_index_from_pos(&newline_indices, mat.start());
                let line_number = line_idx + 1;

                // 同一行只收一次，前端展示这一行里所有高亮
                if last_line_number == Some(line_number) {
                    continue;
                }
                last_line_number = Some(line_number);

                let line_text = get_line_text(content, &newline_indices, line_idx);

                // 对当前行重新跑一遍正则，切出高亮 segments
                let mut segments = Vec::new();
                let mut last_idx = 0;

                for m in re.find_iter(line_text) {
                    if m.start() > last_idx {
                        segments.push(Segment {
                            text: line_text[last_idx..m.start()].to_string(),
                            is_match: false,
                        });
                    }

                    segments.push(Segment {
                        text: line_text[m.start()..m.end()].to_string(),
                        is_match: true,
                    });

                    last_idx = m.end();
                }

                if last_idx < line_text.len() {
                    segments.push(Segment {
                        text: line_text[last_idx..].to_string(),
                        is_match: false,
                    });
                }

                // 防止跨行正则导致本行切不出高亮时，整行为空
                if segments.is_empty() {
                    segments.push(Segment {
                        text: line_text.to_string(),
                        is_match: false,
                    });
                }

                let mut before = Vec::new();
                let mut after = Vec::new();

                for offset in (1..=context_lines).rev() {
                    if line_idx >= offset {
                        before.push(get_line_text(content, &newline_indices, line_idx - offset).to_string());
                    }
                }

                for offset in 1..=context_lines {
                    let target_idx = line_idx + offset;
                    if target_idx < total_lines {
                        after.push(get_line_text(content, &newline_indices, target_idx).to_string());
                    }
                }

                matches.push(MatchItem {
                    line_number,
                    segments,
                    context: MatchContext { before, after },
                });
            }

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

    Ok(SearchResponse {
        files: results,
        filtered_file_count,
    })
}

async fn generate_ai_regex_internal(request: AiRegexRequest) -> anyhow::Result<AiRegexResponse> {
    ensure!(!request.user_prompt.trim().is_empty(), "用户意图为空，无法生成正则表达式。" );
    let api_base = validate_ai_request_common(&request.api_key, &request.base_url, &request.model_name)?;
    let endpoint = format!("{}/chat/completions", api_base);

    let payload = serde_json::json!({
        "model": request.model_name,
        "messages": [
            {"role": "system", "content": request.system_prompt},
            {"role": "user", "content": request.user_prompt}
        ],
        "stream": false
    });

    let client = get_http_client()?;
    let response = client
        .post(&endpoint)
        .bearer_auth(request.api_key)
        .json(&payload)
        .send()
        .await
        .context("AI 请求失败")?;

    let status = response.status();
    let body = response.text().await.context("AI 响应读取失败")?;
    if !status.is_success() {
        bail!("AI 请求失败: HTTP {} - {}", status, body);
    }

    let parsed: OpenAiResponse = serde_json::from_str(&body).context("AI 响应解析失败")?;
    let content = parsed
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default();

    let regex = extract_regex_from_text(&content);
    ensure!(!regex.trim().is_empty(), "AI 未返回有效正则表达式。" );
    Ok(AiRegexResponse { regex })
}

#[tauri::command]
async fn generate_ai_regex(request: AiRegexRequest) -> Result<AiRegexResponse, String> {
    generate_ai_regex_internal(request).await.map_err(|e| e.to_string())
}

async fn stream_ai_chat_internal(window: tauri::Window, request: AiChatStreamRequest) -> anyhow::Result<()> {
    ensure!(!request.messages.is_empty(), "对话内容为空。" );
    let api_base = validate_ai_request_common(&request.api_key, &request.base_url, &request.model_name)?;
    let endpoint = format!("{}/chat/completions", api_base);

    let messages: Vec<serde_json::Value> = request
        .messages
        .iter()
        .map(|m| serde_json::json!({
            "role": m.role,
            "content": m.content,
        }))
        .collect();

    // 构建基础 payload
    let mut payload = serde_json::json!({
        "model": request.model_name,
        "messages": messages,
        "stream": true,
        "stream_options": { "include_usage": true },
    });

    // 根据提供商添加推理参数（兼容不同API）
    let reasoning_params = get_reasoning_params(
        &request.base_url,
        request.enable_thinking,
        request.thinking_budget
    );
    
    // 合并推理参数到 payload
    if let Some(obj) = reasoning_params.as_object() {
        for (key, value) in obj {
            payload[key] = value.clone();
        }
    }

    let client = get_stream_http_client()?;
    let response = client
        .post(&endpoint)
        .bearer_auth(request.api_key)
        .json(&payload)
        .send()
        .await
        .context("AI 请求失败")?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_else(|_| "无法读取响应体".to_string());
        let _ = window.emit("ai-chat-stream", serde_json::json!({
            "requestId": request.request_id,
            "error": format!("AI 请求失败: HTTP {} - {}", status, body),
        }));
        bail!("AI 请求失败: HTTP {} - {}", status, body);
    }

    let mut usage: Option<serde_json::Value> = None;
    let mut done = false;

    // 在函数顶部，把 buffer 改成字节缓冲（这个改动大多数模型都有提，姑且采纳sonnet的写法）
    let mut byte_buf: Vec<u8> = Vec::new();
    let mut text_buf = String::new();
    let mut stream = response.bytes_stream();
    
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.context("AI 流式响应读取失败")?;
        byte_buf.extend_from_slice(&chunk);

        // 从字节缓冲中提取完整 UTF-8 字符，剩余不完整字节留在 byte_buf
        let valid_up_to = match std::str::from_utf8(&byte_buf) {
            Ok(_) => byte_buf.len(),
            Err(e) => e.valid_up_to(),
        };
        let text = std::str::from_utf8(&byte_buf[..valid_up_to]).unwrap();
        let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
        text_buf.push_str(&normalized);
        byte_buf.drain(..valid_up_to);

        for data in collect_sse_events(&mut text_buf) {
            if data == "[DONE]" {
                done = true;
                break;
            }

            let parsed: serde_json::Value = match serde_json::from_str(&data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            if let Some(u) = parsed.get("usage") {
                usage = Some(u.clone());
            }

            let delta = parsed
                .get("choices")
                .and_then(|c| c.as_array())
                .and_then(|arr| arr.first())
                .and_then(|choice| choice.get("delta"));
            
            // 从 delta 里取出的 content 字符串是直接 emit 出去的
            // 使用链式回退兼容不同提供商的推理字段名
            if let Some(delta) = delta {
                let content = delta.get("content").and_then(|v| v.as_str());
                
                // 链式回退：尝试多个可能的推理字段名
                // 优先级：reasoning_content (DeepSeek/硅基流动) > reasoning (OpenRouter) > thinking
                let reasoning = delta.get("reasoning_content")
                    .or_else(|| delta.get("reasoning"))
                    .or_else(|| delta.get("thinking"))
                    .and_then(|v| v.as_str());

                if content.is_some() || reasoning.is_some() {
                    let _ = window.emit("ai-chat-stream", serde_json::json!({
                        "requestId": request.request_id,
                        "delta": {
                            "content": content,
                            "reasoning": reasoning,
                        }
                    }));
                }
            }
        }

        if done {
            break;
        }
    }

    let _ = window.emit("ai-chat-stream", serde_json::json!({
        "requestId": request.request_id,
        "done": true,
        "usage": usage,
    }));

    Ok(())
}

#[tauri::command]
async fn stream_ai_chat(window: tauri::Window, request: AiChatStreamRequest) -> Result<(), String> {
    stream_ai_chat_internal(window, request).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn test_ai_connection(request: AiRegexRequest) -> Result<(), String> {
    let payload = AiRegexRequest {
        user_prompt: "请只回复OK".to_string(),
        system_prompt: request.system_prompt,
        api_key: request.api_key,
        base_url: request.base_url,
        model_name: request.model_name,
    };
    let response = generate_ai_regex(payload).await?;
    if response.regex.trim().is_empty() {
        return Err("AI 连接测试失败：返回为空。".to_string());
    }
    Ok(())
}

// Feedback input validation limits (synced with frontend MAX_LEN)
const FEEDBACK_MAX_CONTRIBUTOR_NICKNAME_LEN: usize = 40;
const FEEDBACK_MAX_FIELD_LEN: usize = 4_000;
const FEEDBACK_MAX_TOTAL_LEN: usize = 12_000;

// 单行输入清洗函数，把换行符、制表符替换成空格
fn sanitize_single_line_input(value: &str) -> String {
    value
        .chars()
        .map(|c| match c {
            '\r' | '\n' | '\t' => ' ',
            _ => c,
        })
        .collect()
}

/// Recursively validate string field lengths in feedback.data
fn validate_feedback_lengths(data: &serde_json::Value, budget: &mut usize) -> Result<(), String> {
    match data {
        serde_json::Value::String(s) => {
            // 更加健壮性的字数预算控制写法
            let len = s.chars().count();
            if len > FEEDBACK_MAX_FIELD_LEN {
                return Err(format!(
                    "A feedback field exceeds the maximum length of {} characters.",
                    FEEDBACK_MAX_FIELD_LEN
                ));
            }
            if len > *budget {
                return Err("Total feedback payload is too large.".to_string());
            }
            *budget -= len;
            Ok(())
        }
        serde_json::Value::Object(map) => {
            for v in map.values() {
                validate_feedback_lengths(v, budget)?;
            }
            Ok(())
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                validate_feedback_lengths(v, budget)?;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

/// 提交反馈到 Formspree（通用接口）
/// 支持翻译反馈、Bug报告等多种类型
/// 
/// Formspree 配置：
/// 1. 访问 https://formspree.io 创建账号
/// 2. 创建新表单，获取表单ID（格式：YOUR_FORM_ID）
/// 3. 将下方 FORMSPREE_FORM_ID 替换为你的表单ID
///
/// 扩展方式：
/// - 前端发送 { type: "bug", data: {...}, timestamp: "..." }
/// - Formspree 会收到包含 type 字段的表单，便于分类处理
#[tauri::command]
async fn submit_feedback(feedback: Feedback) -> Result<(), String> {
    // Input validation
    if feedback.feedback_type.len() > 64 {
        return Err("Invalid feedback type.".to_string());
    }

    // 取出 + 清洗 + 去首尾空格
    let contributor_nickname = sanitize_single_line_input(
        feedback.contributor_nickname.as_deref().unwrap_or("")
    )
    .trim()
    .to_string();

    // 长度校验
    if contributor_nickname.chars().count() > FEEDBACK_MAX_CONTRIBUTOR_NICKNAME_LEN {
        return Err(format!(
            "Contributor nickname exceeds the maximum length of {} characters.",
            FEEDBACK_MAX_CONTRIBUTOR_NICKNAME_LEN
        ));
    }

    // 空值兜底
    let contributor_nickname = if contributor_nickname.is_empty() {
        "Anonymous".to_string()
    } else {
        contributor_nickname
    };

    let mut budget = FEEDBACK_MAX_TOTAL_LEN;
    validate_feedback_lengths(&feedback.data, &mut budget)?;

    // ========== 配置区域 ==========
    // 请替换为你的 Formspree 表单ID
    // 格式: https://formspree.io/f/YOUR_FORM_ID
    const FORMSPREE_FORM_ID: &str = "xbdparne";  // TODO: 替换为你的表单ID
    // ==============================
    
    let formspree_endpoint = format!("https://formspree.io/f/{}", FORMSPREE_FORM_ID);

    let feedback_type_for_log = feedback.feedback_type.clone();
    let language_for_log = feedback
        .data
        .get("language")
        .and_then(|v| v.as_str())
        .unwrap_or("-")
        .to_string();

    let form_data = json!({
        "type": feedback.feedback_type,
        "contributor": contributor_nickname.clone(),
        "data": feedback.data,
        "timestamp": feedback.timestamp,
    });

    // Reuse global HTTP client singleton
    let client = get_http_client().map_err(|e| e.to_string())?;

    let response = client
        .post(&formspree_endpoint)
        .header("Accept", "application/json")
        .json(&form_data)
        .send()
        .await
        .map_err(|e| format!("Network error while submitting feedback: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();

        // Return user-friendly error messages for common Formspree errors
        let msg = if status.as_u16() == 429 {
            "Feedback rate limit reached. Please wait a moment and try again.".to_string()
        } else if status.as_u16() == 422 {
            format!("Formspree rejected the submission (422): {}", body)
        } else {
            format!("Formspree error: HTTP {} - {}", status, body)
        };

        error!("submit_feedback failed: {}", msg);
        return Err(msg);
    }

    info!(
        "Feedback submitted: type={}, contributor={}, lang={}",
        feedback_type_for_log,
        contributor_nickname,
        language_for_log
    );

    Ok(())
}

fn main() {
    tauri::Builder::default()
        // 阻止窗口重复打开
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {

            println!("检测到新实例启动，参数: {:?}, 目录: {:?}", argv, cwd);
            
            // 获取主窗口 (通常 label 叫 "main")
            if let Some(window) = app.get_window("main") {
                // 如果窗口最小化了，就恢复
                let _ = window.unminimize();
                // 聚焦窗口
                let _ = window.set_focus();
                // 将新实例的参数发送给前端监听
                let _ = window.emit("single-instance-args", argv);
            }
        }))
        // 开放给前端的API
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            read_file,
            get_file_stats,
            search_in_files,
            generate_ai_regex,
            test_ai_connection,
            stream_ai_chat,
            submit_feedback
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
