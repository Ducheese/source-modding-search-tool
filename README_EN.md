[中文](./README.md) | English

---

# Source Modding Search Tool

<img src="public/logos/ChatGPT%20Image%202026-03-12.png" alt="App icon" width="100">

A lightweight, high-performance local text search tool for Valve Source 1 engine (CS:S, CS:GO, L4D2, GMod, etc.) mod developers.

**Code developed using the following methods**
1. iFlow CLI + GLM-4.6/4.7 (Created the initial prototype from scratch, first experience with agent power)
2. Gemini 3 Flash/Pro without agent (Main contributions: tech stack migration and frontend/backend performance optimization; advanced options panel as a bonus; also participated in i18n translation review later)
3. OMO Hephaestus + GPT 5.2 Codex (Revived the "spaghetti" code, implemented more context toggles, implemented AI model integration prototype)
4. Claude Sonnet 4.6 without agent (Optimized AI model integration, reviewed "spaghetti" code, color scheme tab, changelog tab, deep thinking control, more context control, chat window minimization, i18n prototype)
5. GPT 5.4 / Claude Sonnet 4.6 without agent proposed plans, iFlow CLI + GLM-5 executed plans (i18n translation review, feedback tab, defensive programming fixes, expand/collapse all button, backend decoding/encoding bug fixes)

## Development Environment Setup

### Prerequisites

1. Install Node.js
2. Install Rustup
3. (Windows) Download Microsoft Visual Studio Build Tools and install "Desktop development with C++"

### Configure Mirror Source

```toml
# After installing Rust, find or create this file (C:\Users\YourName\.cargo\config.toml) and add the following:
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

### Install Dependencies

```bash
# Allow running local scripts you write
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# Download and compile dependencies according to package.json
npm install --verbose
```

### Preview and Build Application

```bash
# Start Tauri application in development mode
npm run tauri dev

# Build as Windows executable
npm run tauri build
```

## Supported File Formats

- `.sp` - SourcePawn script files
- `.cfg` - Configuration files
- `.ini` - Initialization files
- `.txt` - Text files
- `.vmt` - Valve Material files
- `.qc` - Model compilation scripts
- `.inc` - SourcePawn include files
- `.lua` - Lua script files
- `.log` - Log files
- `.vdf` - Valve Data Format files
- `.scr` - User options configuration scripts
- `.res` - VGUI layout and text
- `.nut` - Left 4 Dead map script files

## Technical Architecture

- **Frontend Framework**: React + Material UI component library
- **Backend Framework**: Tauri + Rust

## Project Structure

```
source-modding-search-tool/
├── public/
│   ├── fonts/
│   ├── lang/             # Language VDF files
│   ├── logos/
│   └── index.html
├── src/
│   ├── components/       # React components
│   │   ├── AIChatDialog.js
│   │   ├── ErrorBoundary.js
│   │   ├── FeedbackForm.js
│   │   ├── FileDropZone.js
│   │   ├── FileList.js
│   │   ├── HelpDialog.js
│   │   ├── LangSwitcher.js
│   │   ├── MainLayout.js
│   │   ├── ResultLine.js
│   │   ├── SearchPanel.js
│   │   ├── SearchResults.js
│   │   ├── VirtualizedResults.js
│   │   └── feedback/     # Feedback form sub-components
│   │       ├── ContributorIdentityField.js
│   │       ├── SimpleFeedbackForm.js
│   │       ├── TranslationFeedbackForm.js
│   │       └── TranslationKeyAutocomplete.js
│   ├── hooks/            # Custom React Hooks
│   │   ├── useAiChatSession.js
│   │   ├── useAiRegexExplainer.js
│   │   ├── useAiRegexGenerator.js
│   │   ├── useAiSettings.js
│   │   ├── useChangelog.js
│   │   ├── useFeedbackIdentity.js
│   │   ├── useFeedbackSubmit.js
│   │   ├── useFileScanner.js
│   │   ├── useSearchForm.js
│   │   ├── useSearchHistory.js
│   │   └── useTranslationKeys.js
│   ├── contexts/         # React Context
│   │   ├── LanguageContext.js
│   │   ├── SnackbarContext.js
│   │   └── ThemeSchemeContext.js
│   ├── utils/            # Utility functions
│   │   ├── aiSettingsStorage.js
│   │   ├── chatContextSerializer.js
│   │   ├── feedbackIdentity.js
│   │   ├── fileUtils.js
│   │   ├── i18n.js
│   │   ├── markdownStyles.js
│   │   ├── parseThinkChunk.js
│   │   ├── resultExport.js
│   │   ├── searchService.js
│   │   ├── tauriBridge.js
│   │   ├── themeFactory.js
│   │   └── vdfParser.js
│   ├── config/           # Configuration constants
│   │   ├── aiPromptDefaults.js
│   │   ├── colorSchemes.js
│   │   ├── feedbackConfig.js
│   │   ├── languages.js
│   │   ├── regexCategories.js
│   │   ├── storageKeys.js
│   │   └── supportedFiles.js
│   ├── App.js
│   ├── index.css
│   └── index.js
├── src-tauri/            # Rust backend
│   ├── icons/
│   │   ├── icon.ico
│   │   └── tauri.ico
│   ├── src/
│   │   └── main.rs
│   ├── build.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── test/
├── package.json
└── README.md
```
