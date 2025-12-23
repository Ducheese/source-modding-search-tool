const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const chardet = require('chardet');
const iconv = require('iconv-lite');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
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
  const supportedExtensions = ['.sp', '.cfg', '.ini', '.txt', '.vmt', '.qc', '.inc', '.lua', '.log', '.vdf', '.scr'];
  const files = [];

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else {
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
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
    const lines = content.split('\n').length;    // glm4.6写错的地方
    
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