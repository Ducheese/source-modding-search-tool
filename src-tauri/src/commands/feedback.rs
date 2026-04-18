use crate::utils::get_http_client;
use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ========== 常量 ==========

const FEEDBACK_MAX_CONTRIBUTOR_NICKNAME_LEN: usize = 40;
const FEEDBACK_MAX_FIELD_LEN: usize = 4_000;
const FEEDBACK_MAX_TOTAL_LEN: usize = 12_000;

// ========== 结构体定义 ==========

#[derive(Deserialize, Serialize, Clone)]
pub struct Feedback {
    #[serde(rename = "type")]
    pub feedback_type: String,
    #[serde(rename = "contributor", default)]
    pub contributor_nickname: Option<String>,
    pub data: serde_json::Value,
    pub timestamp: String,
}

// ========== 辅助函数 ==========

/// 单行输入清洗函数，把换行符、制表符替换成空格
pub fn sanitize_single_line_input(value: &str) -> String {
    value
        .chars()
        .map(|c| match c {
            '\r' | '\n' | '\t' => ' ',
            _ => c,
        })
        .collect()
}

/// 递归验证字符串字段长度
pub fn validate_feedback_lengths(data: &serde_json::Value, budget: &mut usize) -> Result<(), String> {
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

// ========== Tauri 命令 ==========

/// 提交反馈到 Formspree（通用接口）
#[tauri::command]
pub async fn submit_feedback(feedback: Feedback) -> Result<(), String> {
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

    // Formspree 配置
    const FORMSPREE_FORM_ID: &str = "xbdparne";
    
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

    // Reuse HTTP client singleton
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
