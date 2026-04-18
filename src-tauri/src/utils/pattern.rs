use globset::{GlobSet, GlobSetBuilder};

/// 构建Glob 集合
pub fn build_pattern_set(patterns_str: &str) -> Result<Option<GlobSet>, String> {
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
