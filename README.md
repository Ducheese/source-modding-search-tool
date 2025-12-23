# Source Modding Search Tool

为 Valve Source 1 引擎（CS:S, CS:GO, L4D2, Gmod等）的 Mod 开发者提供一个轻量、高性能的本地文本检索工具。

## 功能特性

- **零依赖绿色软件**：解压即用，无需安装运行环境
- **本地化处理**：所有运算在客户端本地完成，不上传文件
- **高性能**：能够处理大文件（500MB+ 日志）和海量小文件（5000+ 源码文件）
- **多编码支持**：自动检测 UTF-8, GBK, GB2312, Big5, ISO-8859-1, UTF-16 等编码
- **拖拽支持**：支持文件和文件夹拖拽
- **高级搜索**：支持区分大小写、全词匹配、正则表达式
- **搜索历史**：自动保存最近 10 条搜索记录
- **虚拟化列表**：大量搜索结果时自动启用虚拟化渲染
- **主题切换**：支持浅色/深色主题，默认跟随系统
- **导出功能**：支持导出搜索结果为 TXT 或 Markdown 格式

## 开发环境设置

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
# 启动 React 开发服务器
npm start

# 在另一个终端启动 Electron
npm run electron-dev
```

### 构建应用

```bash
# 构建 React 应用
npm run build

# 打包为 Windows 可执行文件
npm run electron-pack
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

## 性能优化

- **多线程处理**：文件扫描与文本匹配在后台线程执行
- **流式读取**：大文件（>10MB）采用分块读取，防止内存溢出
- **虚拟化渲染**：搜索结果超过阈值时自动启用虚拟化列表
- **搜索限制**：大文件搜索结果限制为 1000 个匹配项
- **并发控制**：限制同时处理的文件数量，避免系统过载

## 系统要求

- Windows 10/11
- 内存：建议 4GB 以上
- 硬盘空间：至少 100MB 可用空间

## 技术架构

- **前端框架**：React 18 + Material UI
- **桌面框架**：Electron
- **编码检测**：chardet
- **字符转换**：iconv-lite
- **构建工具**：electron-builder

## 项目结构

```
source-modding-search-tool/
├── public/
│   ├── electron.js       # Electron 主进程
│   ├── preload.js        # 预加载脚本
│   └── index.html        # HTML 模板
├── src/
│   ├── components/       # React 组件
│   │   ├── MainLayout.js
│   │   ├── FileDropZone.js
│   │   ├── FileList.js
│   │   ├── SearchPanel.js
│   │   ├── SearchResults.js
│   │   └── VirtualizedResults.js
│   ├── utils/           # 工具函数
│   │   └── searchEngine.js
│   ├── App.js           # 主应用组件
│   └── index.js         # 应用入口
├── package.json
└── README.md
```

## 验收标准

- ✅ 大文件测试：500MB 日志文件搜索，内存占用不超过 200MB
- ✅ 海量文件测试：5000 个 .sp 文件搜索，UI 保持响应
- ✅ 乱码测试：混合 GBK 和 UTF-8 文件正常显示和检索
- ✅ 环境测试：纯净 Windows 10/11 环境直接运行

## 许可证

ISC License