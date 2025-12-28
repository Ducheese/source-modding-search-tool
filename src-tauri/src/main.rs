#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rayon::prelude::*;
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use walkdir::WalkDir;

// 凡人能看懂的文件状态
#[derive(Serialize, Clone)]
struct FileStats {
    size: u64,
    lines: usize,
    encoding: String,
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
    line: String,
    context: MatchContext,
}

#[derive(Serialize, Clone)]
struct MatchContext {
    before: Option<String>,
    after: Option<String>,
}

#[derive(Deserialize)]
struct SearchOptions {
    query: String,
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
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

// 1. 扫描目录：不再阻塞主线程
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

// 2. 获取文件状态：并行处理，瞬间完成
#[tauri::command]
async fn get_file_stats(file_paths: Vec<String>) -> Result<Vec<FileStats>, String> {
    // 使用 rayon 并行迭代器，哪怕成千上万个文件也无需等待
    let stats: Vec<FileStats> = file_paths
        .par_iter()
        .map(|path_str| {
            let path = Path::new(path_str);
            let metadata = fs::metadata(path).ok();
            let size = metadata.map(|m| m.len()).unwrap_or(0);
            
            // 简单读取一下头部判断编码，不需要全读
            let (content, encoding) = read_file_content(path).unwrap_or((String::new(), "Unknown".to_string()));
            let lines = content.lines().count();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

            FileStats {
                size,
                lines,
                encoding,
                path: path_str.clone(),
                name,
            }
        })
        .collect();

    Ok(stats)
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

// 4. 核心：极速搜索。用 Rust 的正则引擎和多线程把 JS 秒成渣。
#[tauri::command]
async fn search_in_files(files: Vec<String>, options: SearchOptions) -> Result<Vec<SearchResult>, String> {
    let query = if options.use_regex {
        options.query.clone()
    } else {
        regex::escape(&options.query)
    };

    let pattern = if options.whole_word && !options.use_regex {
        format!(r"\b{}\b", query)
    } else {
        query
    };

    // 构建正则表达式
    let re = RegexBuilder::new(&pattern)
        .case_insensitive(!options.case_sensitive)
        .build()
        .map_err(|e| format!("无效的正则表达式: {}", e))?;

    // 并行搜索！感受并行的力量吧！
    let results: Vec<SearchResult> = files
        .par_iter() // 并行迭代器
        .filter_map(|path_str| {
            let path = Path::new(path_str);
            let (content, _) = read_file_content(path).ok()?;
            
            if content.is_empty() {
                return None;
            }

            let lines: Vec<&str> = content.lines().collect();
            let mut matches = Vec::new();

            // 遍历每一行进行匹配
            for (i, line) in lines.iter().enumerate() {
                if re.is_match(line) {
                    matches.push(MatchItem {
                        line_number: i + 1,
                        line: line.to_string(),
                        context: MatchContext {
                            before: if i > 0 { Some(lines[i - 1].to_string()) } else { None },
                            after: if i < lines.len() - 1 { Some(lines[i + 1].to_string()) } else { None },
                        },
                    });
                }
            }

            if !matches.is_empty() {
                // 限制单文件匹配数量，防止撑爆内存
                if matches.len() > 500 {
                    matches.truncate(500);
                }
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
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            read_file,
            get_file_stats,
            search_in_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}