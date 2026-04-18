use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tauri::{FileDropEvent, Window, WindowEvent};

/// 前端只监听这个事件，不再直接监听 tauri://file-drop-hover
pub const VALIDATED_FILE_DRAG_EVENT: &str = "validated-file-drag";

/// 每个窗口一个 active 状态
/// key: window label
pub type DragStateMap = Arc<Mutex<HashMap<String, bool>>>;

#[derive(Serialize, Clone)]
struct ValidatedFileDragPayload {
    #[serde(rename = "type")]
    event_type: &'static str,

    #[serde(skip_serializing_if = "Option::is_none")]
    paths: Option<Vec<String>>,
}

/// 创建拖拽状态容器
pub fn new_drag_state() -> DragStateMap {
    Arc::new(Mutex::new(HashMap::new()))
}

/// 单个 path 是否是"真实存在的本地文件或文件夹"
/// 这是整个"去误触发"的核心过滤器。
fn is_existing_local_file_or_dir(path: &Path) -> bool {
    if path.as_os_str().is_empty() {
        return false;
    }

    // 不是绝对路径，直接排除
    if !path.is_absolute() {
        return false;
    }

    match fs::metadata(path) {
        Ok(metadata) => metadata.is_file() || metadata.is_dir(),
        Err(_) => false,
    }
}

/// hover 阶段只需要知道：
/// "这批拖拽数据里，是否至少有一个真实有效的文件/文件夹"
///
/// 不要在 hover 阶段把所有路径转字符串再发给前端，原因有两个：
/// 1. 没必要，前端只需要一个亮/不亮
/// 2. 减少 hover 高频事件带来的 IPC 负担
fn has_any_valid_drag_path(paths: &[PathBuf]) -> bool {
    paths.iter().any(|path| is_existing_local_file_or_dir(path))
}

/// drop 阶段才需要把所有有效路径完整收集出来
fn collect_valid_drag_paths(paths: &[PathBuf]) -> Vec<String> {
    let mut result = Vec::new();
    let mut seen = HashSet::new();

    for path in paths {
        if !is_existing_local_file_or_dir(path) {
            continue;
        }

        let path_str = path.to_string_lossy().into_owned();
        if seen.insert(path_str.clone()) {
            result.push(path_str);
        }
    }

    result
}

/// 把当前窗口的 active 状态替换成 next，返回旧值
fn replace_drag_active(state: &DragStateMap, window_label: &str, next: bool) -> bool {
    let Ok(mut map) = state.lock() else {
        return false;
    };

    let prev = map.get(window_label).copied().unwrap_or(false);

    if next {
        map.insert(window_label.to_string(), true);
    } else {
        map.remove(window_label);
    }

    prev
}

fn emit_validated_drag_event(
    window: &Window,
    event_type: &'static str,
    paths: Option<Vec<String>>,
) {
    let payload = ValidatedFileDragPayload { event_type, paths };
    let _ = window.emit(VALIDATED_FILE_DRAG_EVENT, payload);
}

/// 这是核心状态机：
/// 原始 Tauri 事件 -> Rust 验证 -> 只向前端发干净事件
pub fn handle_validated_file_drop_window_event(
    window: &Window,
    event: &WindowEvent,
    drag_state: &DragStateMap,
) {
    let window_label = window.label().to_string();

    match event {
        WindowEvent::FileDrop(file_drop_event) => match file_drop_event {
            FileDropEvent::Hovered(paths) => {
                let has_valid_path = has_any_valid_drag_path(paths);

                // 原始 hover 触发了，但里面没有任何真实文件/文件夹
                // 这说明是"脏 hover"，不能让前端亮
                if !has_valid_path {
                    if replace_drag_active(drag_state, &window_label, false) {
                        emit_validated_drag_event(window, "leave", None);
                    }
                    return;
                }

                // 只有从 inactive -> active 的跃迁才发 enter
                let was_active = replace_drag_active(drag_state, &window_label, true);
                if !was_active {
                    emit_validated_drag_event(window, "enter", None);
                }
            }

            FileDropEvent::Dropped(paths) => {
                let valid_paths = collect_valid_drag_paths(paths);
                let was_active = replace_drag_active(drag_state, &window_label, false);

                // drop 里如果仍然没有任何真实路径，就不发 drop，最多补一个 leave
                if valid_paths.is_empty() {
                    if was_active {
                        emit_validated_drag_event(window, "leave", None);
                    }
                    return;
                }

                emit_validated_drag_event(window, "drop", Some(valid_paths));
            }

            FileDropEvent::Cancelled => {
                if replace_drag_active(drag_state, &window_label, false) {
                    emit_validated_drag_event(window, "leave", None);
                }
            }

            // FileDropEvent is marked as non-exhaustive, so we need a wildcard
            _ => {}
        },

        // 有些异常拖拽场景 cancelled 不一定稳定
        // 焦点丢失时兜底重置一次，避免前端卡在 active
        WindowEvent::Focused(false) => {
            if replace_drag_active(drag_state, &window_label, false) {
                emit_validated_drag_event(window, "leave", None);
            }
        }

        _ => {}
    }
}
