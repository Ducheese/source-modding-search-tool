const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  openFileExternally: (filePath) => ipcRenderer.invoke('open-file-externally', filePath),
  scanDirectory: (dirPath) => ipcRenderer.invoke('scan-directory', dirPath),
  getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
});