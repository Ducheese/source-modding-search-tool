use crate::utils::{get_http_client, get_stream_http_client};
use anyhow::{bail, Context, ensure};
use futures_util::StreamExt;
use log::warn;
use serde::{Deserialize, Serialize};
use url::Url;

// ========== 结构体定义 ==========

#[derive(Deserialize)]
pub struct AiRegexRequest {
    pub user_prompt: String,
    pub system_prompt: String,
    pub api_key: String,
    pub base_url: String,
    pub model_name: String,
}

#[derive(Serialize)]
pub struct AiRegexResponse {
    pub regex: String,
}

#[derive(Deserialize)]
pub struct AiChatMessage {
    pub role: String,
    pub content: String,
}

fn default_enable_thinking() -> bool { false }
fn default_thinking_budget() -> u16 { 4096 }

#[derive(Deserialize)]
pub struct AiChatStreamRequest {
    pub messages: Vec<AiChatMessage>,
    pub api_key: String,
    pub base_url: String,
    pub model_name: String,
    pub request_id: String,
    #[serde(default = "default_enable_thinking")]
    pub enable_thinking: bool,
    #[serde(default = "default_thinking_budget")]
    pub thinking_budget: u16,
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

// ========== 辅助函数 ==========

/// 规范化 API Base URL
pub fn normalize_base_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return String::new();
    }
    
    // 如果已经是完整的 /v1/chat/completions 端点
    if trimmed.ends_with("/v1/chat/completions") {
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

/// 提取 host 用于判断提供商
pub fn extract_host(base_url: &str) -> String {
    Url::parse(base_url)
        .ok()
        .and_then(|url| url.host_str().map(|s| s.to_lowercase()))
        .unwrap_or_default()
}

/// 根据提供商生成推理参数
pub fn get_reasoning_params(base_url: &str, enable_thinking: bool, thinking_budget: u16) -> serde_json::Value {
    let host = extract_host(base_url);
    
    match host.as_str() {
        // OpenRouter: 使用 reasoning 对象
        h if h.contains("openrouter.ai") => {
            if enable_thinking {
                serde_json::json!({
                    "reasoning": {
                        "max_tokens": thinking_budget
                    }
                })
            } else {
                serde_json::json!({})
            }
        }
        
        // DeepSeek / 硅基流动: 使用 enable_thinking + thinking_budget
        h if h.contains("api.siliconflow.cn") || h.contains("api.deepseek.com") => {
            serde_json::json!({
                "enable_thinking": enable_thinking,
                "thinking_budget": if enable_thinking { thinking_budget } else { 0 }
            })
        }
        
        // 豆包 (火山): 使用 thinking.type
        h if h.contains("ark.cn-beijing.volces.com") || h.contains("ark.cn-beijing.volcengineapi.com") => {
            serde_json::json!({
                "thinking": {
                    "type": if enable_thinking { "enabled" } else { "disabled" }
                }
            })
        }
        
        // 阿里云百炼: 使用 enable_thinking + thinking_budget
        h if h.contains("dashscope.aliyuncs.com") => {
            serde_json::json!({
                "enable_thinking": enable_thinking,
                "thinking_budget": if enable_thinking { thinking_budget } else { 0 }
            })
        }
        
        // 默认使用 OpenRouter 格式（兼容性最好）
        _ => {
            if enable_thinking {
                warn!(
                    "未知提供商 host: {}，使用 OpenRouter 格式的推理参数，可能不兼容",
                    host
                );
                serde_json::json!({
                    "reasoning": {
                        "max_tokens": thinking_budget
                    }
                })
            } else {
                serde_json::json!({})
            }
        }
    }
}

/// SSE 事件收集器（逐条对照 RFC 8895 检验都没问题）
pub fn collect_sse_events(buffer: &mut String) -> Vec<String> {
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

/// 从 AI 响应中提取正则表达式
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

/// 验证 AI 请求公共参数
fn validate_ai_request_common(api_key: &str, base_url: &str, model_name: &str) -> anyhow::Result<String> {
    ensure!(!api_key.trim().is_empty(), "API Key 不能为空。");
    ensure!(!base_url.trim().is_empty(), "API Base Url 不能为空。");
    ensure!(!model_name.trim().is_empty(), "模型名称不能为空。");

    let api_base = normalize_base_url(base_url);
    ensure!(!api_base.is_empty(), "API Base Url 无效。");
    Ok(api_base)
}

// ========== 内部实现 ==========

async fn generate_ai_regex_internal(request: AiRegexRequest) -> anyhow::Result<AiRegexResponse> {
    ensure!(!request.user_prompt.trim().is_empty(), "用户意图为空，无法生成正则表达式。");
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

    let client = get_http_client();
    let response = client
        .post(&endpoint)
        .bearer_auth(request.api_key)
        .json(&payload)
        .send()
        .await
        .context("AI 请求失败")?;

    let status = response.status();
    let body: String = response.text().await.unwrap_or_else(|_| "无法读取响应体".to_string());
    if !status.is_success() {
        bail!("AI 请求失败: HTTP {} - {}", status, body);
    }

    let parsed: OpenAiResponse = serde_json::from_str(&body).unwrap_or_else(|_| {
        log::warn!("AI 响应解析失败: {}", body);
        OpenAiResponse { choices: Vec::new() }
    });
    let content = parsed
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default();

    let regex = extract_regex_from_text(&content);
    ensure!(!regex.trim().is_empty(), "AI 未返回有效正则表达式。");
    Ok(AiRegexResponse { regex })
}

async fn stream_ai_chat_internal(window: tauri::Window, request: AiChatStreamRequest) -> anyhow::Result<()> {
    ensure!(!request.messages.is_empty(), "对话内容为空。");
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

    let client = get_stream_http_client();
    let response = client
        .post(&endpoint)
        .bearer_auth(request.api_key)
        .json(&payload)
        .send()
        .await
        .context("AI 请求失败")?;

    let status = response.status();
    if !status.is_success() {
        let body: String = response.text().await.unwrap_or_else(|_| "无法读取响应体".to_string());
        let _ = window.emit("ai-chat-stream", serde_json::json!({
            "requestId": request.request_id,
            "error": format!("AI 请求失败: HTTP {} - {}", status, body),
        }));
        // 不再 bail!，返回 Ok(()) 让前端通过事件流感知错误
        return Ok(());
    }

    let mut usage: Option<serde_json::Value> = None;
    let mut done = false;

    // 在函数顶部，把 buffer 改成字节缓冲
    let mut byte_buf: Vec<u8> = Vec::new();
    let mut text_buf = String::new();
    let mut stream = response.bytes_stream();
    
    while let Some(chunk_result) = stream.next().await {
        let chunk = match chunk_result {
            Ok(chunk) => chunk,
            Err(e) => {
                let _ = window.emit("ai-chat-stream", serde_json::json!({
                    "requestId": request.request_id,
                    "error": format!("AI 流式响应读取失败: {}", e),
                }));
                return Ok(());
            }
        };
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

// ========== Tauri 命令 ==========

#[tauri::command]
pub async fn generate_ai_regex(request: AiRegexRequest) -> Result<AiRegexResponse, String> {
    generate_ai_regex_internal(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stream_ai_chat(window: tauri::Window, request: AiChatStreamRequest) -> Result<(), String> {
    stream_ai_chat_internal(window, request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_ai_connection(request: AiRegexRequest) -> Result<(), String> {
    // 连接测试不需要 system_prompt，使用空字符串覆盖
    let payload = AiRegexRequest {
        user_prompt: "请只回复OK".to_string(),
        system_prompt: String::new(),
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
