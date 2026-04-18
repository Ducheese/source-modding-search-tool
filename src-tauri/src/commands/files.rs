use crate::utils::{decode_text, is_binary};
use anyhow::Context;
use memmap2::Mmap;
use rayon::prelude::*;
use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Serialize, Clone)]
pub struct FileStats {
    pub size: u64,
    pub lines: usize,
    pub encoding: String,
    pub path: String,
    pub name: String,
}

/// 扫描目录：使用 spawn_blocking 包装阻塞式 WalkDir
/// 明确表示这是阻塞 IO 操作，避免阻塞 Tauri 的异步运行时
/// 只要前端传文件夹路径，这里就负责递归到底
#[tauri::command]
pub async fn scan_directory(dir_path: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let files: Vec<String> = WalkDir::new(dir_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .map(|e| e.path().to_string_lossy().into_owned())
            .collect();
        Ok::<Vec<String>, String>(files)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 极速获取文件状态
#[tauri::command]
pub async fn get_file_stats(file_paths: Vec<String>) -> Result<Vec<FileStats>, String> {
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

                // 统一使用 decode_text() 获取编码（UTF-8 优先，避免误判）
                let (_, encoding) = decode_text(&mmap);

                FileStats { size, lines, encoding, path: path_str.clone(), name }
            } else {
                FileStats { size, lines: 0, encoding: "AccessDenied".into(), path: path_str.clone(), name }
            }
        })
        .collect();

    Ok(stats)
}

/// 辅助函数：读取并解码文件，这是从混沌中提取秩序的过程
pub fn read_file_content(path: &Path) -> anyhow::Result<(String, String)> {
    let mut file = File::open(path)?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;

    // 检查是否为二进制文件，如果是，直接忽略，免得污了我的眼
    if is_binary(&buffer) {
        return Ok((String::new(), "Binary".to_string()));
    }

    // 统一使用 decode_text() 解码（UTF-8 优先，避免误判）
    let (cow, encoding) = decode_text(&buffer);
    Ok((cow.into_owned(), encoding))
}

/// 读取单个文件内容
#[tauri::command]
pub async fn read_file(path: String) -> Result<serde_json::Value, String> {
    let path_obj = Path::new(&path);
    match read_file_content(path_obj) {
        Ok((content, encoding)) => Ok(serde_json::json!({
            "content": content,
            "encoding": encoding
        })),
        Err(e) => Err(e.to_string()),
    }
}
