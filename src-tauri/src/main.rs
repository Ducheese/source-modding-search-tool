#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rayon::prelude::*;
use regex::bytes::RegexBuilder; // 注意：改为 bytes 的正则
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use walkdir::WalkDir;
use memmap2::Mmap; // 引入内存映射
use globset::{GlobSet, GlobSetBuilder}; // 【新神语】召唤真神的三位一体
use tauri::Manager; // 单例模式，阻止窗口重复打开

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
            let mmap = unsafe { Mmap::map(&file).ok() };
            
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

// 4. 核心：基于 Mmap 和 Byte Regex 的极速搜索
#[tauri::command]
async fn search_in_files(
    files: Vec<String>, // 这是从前端传来的、未经筛选的完整列表
    options: SearchOptions,
) -> Result<Vec<SearchResult>, String> {
    
    // --- 【敕令核心】在此处设下结界！ ---
    let include_set = build_pattern_set(&options.include_pattern)?;
    let exclude_set = build_pattern_set(&options.exclude_pattern)?;

    // 从完整的 `files` 列表中，筛选出我们真正需要的“精锐之师”
    let target_files: Vec<String> = files
        .into_par_iter() // 用 Rayon 并行过滤，即便列表很长也很快
        .filter(|path_str| {
            let path = Path::new(path_str);
            
            // 法则一：排除优先
            if let Some(exclude) = &exclude_set {
                if exclude.is_match(path) {
                    return false;
                }
            }
            
            // 法则二：包含守则 (如果设置了的话)
            if let Some(include) = &include_set {
                if !include.is_match(path) {
                    return false;
                }
            }
            
            true // 通过所有审判的，才是真正的勇士
        })
        .collect();
    // --- 结界完成 ---

    // 构造字节级正则，性能比起字符串正则更稳定
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

    // 使用 bytes::RegexBuilder
    let re = RegexBuilder::new(&final_pattern)
        .case_insensitive(!options.case_sensitive)
        .multi_line(options.use_regex) // 支持匹配行首行尾。行尾情况比较复杂，存在\r\n和\n两种换行格式，此时的$只会匹配到\n之前的位置，也就是说\r被视为内容之一，而不是换行符。
        .unicode(true) // 开启 unicode 支持以处理中文
        .build()
        .map_err(|e| format!("无效的正则表达式: {}", e))?;

    // 【重点】现在，我们只对筛选后的 `target_files` 进行最终的审判！
    let results: Vec<SearchResult> = target_files // <- 注意，用的是这个！
        .par_iter()
        .filter_map(|path_str| {
            let path = Path::new(path_str);
            let file = File::open(path).ok()?;
            let mmap = unsafe { Mmap::map(&file).ok()? };

            // 二进制检查
            if is_binary(&mmap) { return None; }
            
            let mut matches: Vec<MatchItem> = Vec::new();
            
            // 为了高效获取上下文，我们先预计算所有换行符的位置。
            // 这一步会消耗一些时间，但只执行一次，能让后续的行号和上下文查找变得极快且准确。
            let newline_indices: Vec<usize> = mmap.iter()
                .enumerate()
                .filter(|(_, &b)| b == b'\n')
                .map(|(i, _)| i)
                .collect();
            let total_lines = newline_indices.len() + if mmap.is_empty() { 0 } else { 1 };

            // 在 mmap 上直接搜索
            for mat in re.find_iter(&mmap) {
                if matches.len() >= 500 { break; } // 限制数量

                let start = mat.start();

                // **** 【上下文/行号获取的精髓部分】 ****

                // 1. 确定匹配行号 (i) 和当前行在 newline_indices 中的索引 (line_idx)
                // line_idx 是当前行前的换行符索引，用于定位
                // 使用二分查找（Binary Search）在预计算的索引中定位，这是 O(log N) 的操作，比 O(N) 的遍历快得多！
                let line_idx = match newline_indices.binary_search(&start) {
                    Ok(i) => i,        // 匹配点正好在换行符上，通常不会发生
                    Err(i) => i.min(newline_indices.len()), // 换行符的索引
                };
                
                let line_number = line_idx + 1;

                // 2. 确定当前行的起止位置
                let line_start = if line_idx == 0 { 0 } else { newline_indices[line_idx - 1] + 1 };
                let line_end = if line_idx >= newline_indices.len() { mmap.len() } else { newline_indices[line_idx] };
                
                // 3. 避免重复添加同一行的多个匹配
                // 检查 matches 中最后一个元素的行号，如果相同，说明这一行已经被添加过了（包含了所有高亮），直接跳过
                if let Some(last) = matches.last() {
                    if last.line_number == line_number {
                        continue;
                    }
                }

                // 4. 生成高亮片段 (Segments) - 这就是你要的“后端处理正则切分”
                // 我们需要对 *这一行* 再次运行正则，找出 *所有* 匹配项，然后切分
                let line_bytes = &mmap[line_start..line_end];
                let mut segments = Vec::new();
                let mut last_idx = 0;

                // 注意：re.find_iter 是基于整个 mmap 的。
                // 为了只处理当前行，我们可以截取 line_bytes 并对其运行正则？
                // 不，这样性能不好。我们已经有了 pattern，直接在 line_bytes 上跑一个新的 find_iter 即可。
                // 这里的开销极小，因为 line_bytes 通常很短。
                
                for m in re.find_iter(line_bytes) {
                    let m_start = m.start();
                    let m_end = m.end();

                    // 添加匹配前的普通文本
                    if m_start > last_idx {
                        let text = String::from_utf8_lossy(&line_bytes[last_idx..m_start]).to_string();
                        segments.push(Segment { text, is_match: false });
                    }
                    
                    // 添加匹配文本
                    let text = String::from_utf8_lossy(&line_bytes[m_start..m_end]).to_string();
                    segments.push(Segment { text, is_match: true });

                    last_idx = m_end;
                }

                // 添加剩余文本
                if last_idx < line_bytes.len() {
                    let mut text = String::from_utf8_lossy(&line_bytes[last_idx..]).to_string();
                    // 移除末尾可能的 \r
                    if text.ends_with('\r') { text.pop(); }
                    segments.push(Segment { text, is_match: false });
                }

                let context_lines = if options.context_lines == 0 { 1 } else { options.context_lines };

                let get_line_text = |target_idx: usize| -> String {
                    let target_start = if target_idx == 0 { 0 } else { newline_indices[target_idx - 1] + 1 };
                    let target_end = if target_idx >= newline_indices.len() { mmap.len() } else { newline_indices[target_idx] };
                    let mut text = String::from_utf8_lossy(&mmap[target_start..target_end]).to_string();
                    if text.ends_with('\r') { text.pop(); }
                    text
                };

                // 3. 提取多行上下文（Before/After）
                let mut before = Vec::new();
                let mut after = Vec::new();

                if context_lines > 0 {
                    for offset in (1..=context_lines).rev() {
                        if line_idx >= offset {
                            before.push(get_line_text(line_idx - offset));
                        }
                    }

                    for offset in 1..=context_lines {
                        let target_idx = line_idx + offset;
                        if target_idx < total_lines {
                            after.push(get_line_text(target_idx));
                        }
                    }
                }

                // **** 【上下文/行号获取的精髓部分】END ****
                
                matches.push(MatchItem {
                    line_number,
                    segments, // 这里直接给前端片段
                    context: MatchContext { before, after },
                });
            }

            // ... (结果返回逻辑不变) ...
            if !matches.is_empty() {
                Some(SearchResult {
                    path: path_str.clone(),
                    name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                    matches,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(results)
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
            search_in_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
