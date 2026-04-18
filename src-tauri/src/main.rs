// Tauri 应用入口 - 装配器模式
// 所有业务逻辑已拆分到独立的模块中
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;  // Tauri 命令模块
mod file_drop; // 文件拖拽处理
mod utils;     // 工具函数模块

// 导入所有 Tauri 命令（从 commands 模块）
use commands::{
    generate_ai_regex, get_file_stats, read_file, scan_directory, search_in_files,
    stream_ai_chat, submit_feedback, test_ai_connection,
};
use file_drop::{handle_validated_file_drop_window_event, new_drag_state};
use tauri::Manager;

fn main() {
    // 创建拖拽状态管理器
    let drag_state = new_drag_state();

    tauri::Builder::default()
        // 处理窗口文件拖拽事件
        .on_window_event({
            let drag_state = drag_state.clone();
            move |event| {
                handle_validated_file_drop_window_event(
                    event.window(),
                    event.event(),
                    &drag_state,
                );
            }
        })
        // 单实例模式：阻止窗口重复打开
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
        // 注册所有 Tauri 命令到前端
        .invoke_handler(tauri::generate_handler![
            scan_directory,      // 扫描目录
            read_file,           // 读取文件
            get_file_stats,      // 获取文件统计
            search_in_files,     // 文件搜索
            generate_ai_regex,   // 生成正则表达式
            test_ai_connection,  // 测试 AI 连接
            stream_ai_chat,      // 流式对话
            submit_feedback      // 提交反馈
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
