use once_cell::sync::Lazy;
use reqwest::Client;
use std::time::Duration;

/// 用于 AI 写正则 / 解释正则：响应快，超时短
static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(5))
        .build()
        .expect("创建HTTP客户端失败")
});

/// 用于流式对话：输出可能较长，超时宽松
static STREAM_HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(180))
        .connect_timeout(Duration::from_secs(5))
        .build()
        .expect("创建流式HTTP客户端失败")
});

/// 获取普通 HTTP 客户端（短超时）
pub fn get_http_client() -> &'static Client {
    &HTTP_CLIENT
}

/// 获取流式 HTTP 客户端（长超时）
pub fn get_stream_http_client() -> &'static Client {
    &STREAM_HTTP_CLIENT
}
