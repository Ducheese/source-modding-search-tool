# Source Modding Search Tool

为 Valve Source 1 引擎（CS:S, CS:GO, L4D2, Gmod等）的 Mod 开发者提供一个轻量、高性能的本地文本检索工具。

**代码基于iFlow CLI + GLM-4.6/4.7 + Gemini 3 Flash/Pro开发**。

## 开发环境设置

### 前置环境

1.   安装Node.js
2.   安装Rustup
3.   （Windows）下载Microsoft Visual Studio Build Tools，安装“使用C++的桌面开发”

### 设置镜像源

```toml
# 安装好Rust后，找到或新建此文件（C:\Users\用户名\.cargo\config.toml），写入如下内容：
[source.crates-io]
replace-with = 'rsproxy-sparse'

[source.rsproxy]
registry = "https://rsproxy.cn/crates.io-index"

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"

[registries.rsproxy]
index = "https://rsproxy.cn/crates.io-index"

[net]
git-fetch-with-cli = true
```

### 安装依赖包

```bash
# 依照package.json，进行依赖的下载和编译
npm install --verbose
```

### 预览和构建应用

```bash
# 启动 Tauri 应用的开发模式
npm run tauri dev

# 构建为 Windows 可执行文件
npm run tauri build
```

## 支持的文件格式

- `.sp` - SourcePawn 脚本文件
- `.cfg` - 配置文件
- `.ini` - 初始化文件
- `.txt` - 文本文件
- `.vmt` - Valve Material 文件
- `.qc` - 模型编译脚本
- `.inc` - SourcePawn 包含文件
- `.lua` - Lua 脚本文件
- `.log` - 日志文件
- `.vdf` - Valve Data Format 文件
- `.scr` - 脚本文件

## 技术架构

- **前端框架**：React + Material UI组件库
- **后端框架**：Tauri + Rust

## 项目结构

```
source-modding-search-tool/
├── public/
│   └── index.html        # HTML 模板
├── src/
│   ├── components/       # React 前端
│   │   ├── FileDropZone.js
│   │   ├── FileList.js
│   │   ├── MainLayout.js
│   │   ├── ResultLine.js
│   │   ├── SearchPanel.js
│   │   ├── SearchResults.js
│   │   └── VirtualizedResults.js
│   ├── utils/            # 工具函数
│   │   ├── searchEngine.js
│   │   └── tauriBridge.js
│   ├── App.js            # 主应用组件
│   └── index.js          # 应用入口
├── src-tauri/            # Rust 后端
│   ├── icons/
│   │   └── icon.ico
│   └── src/
│   │   └── main.rs
│   ├── build.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── test/                 # 测试用文本生成脚本
├── package.json
└── README.md
```
