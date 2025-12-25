const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const chardet = require('chardet');
const iconv = require('iconv-lite');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    // minHeight: 600,
    resizable: true,
    maximizable: true,
    minimizable: true,
    fullscreenable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.ico'),
    show: false
  });

  const isDev = process.env.NODE_ENV === 'development';
  const startUrl = isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Source Files',
        extensions: ['sp', 'cfg', 'ini', 'txt', 'vmt', 'qc', 'inc', 'lua', 'log', 'vdf', 'scr']
      }
    ]
  });

  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const encoding = chardet.detect(buffer);
    const content = iconv.decode(buffer, encoding);
    return { content, encoding };
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle('open-file-externally', async (event, filePath) => {
  const { shell } = require('electron');
  await shell.openPath(filePath);
});

ipcMain.handle('scan-directory', async (event, dirPath) => {
  // 注意：这里不再过滤文件格式，让前端处理格式校验
  // 这样可以提供更好的用户体验和错误反馈
  const files = [];

  function scanDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else {
          // 返回所有文件，让前端进行格式校验
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dir}:`, error.message);
    }
  }

  try {
    scanDirectory(dirPath);
    return files;
  } catch (error) {
    throw new Error(`Failed to scan directory: ${error.message}`);
  }
});

ipcMain.handle('get-file-stats', async (event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    const buffer = fs.readFileSync(filePath);
    const encoding = chardet.detect(buffer);
    
    // Count lines
    const content = iconv.decode(buffer, encoding);
    const lines = content.split('\n').length;
    
    return {
      size: stat.size,
      lines: lines,
      encoding: encoding,
      modified: stat.mtime
    };
  } catch (error) {
    throw new Error(`Failed to get file stats: ${error.message}`);
  }
});