import React, { useCallback, useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  useTheme,
  alpha,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  CloudUpload,
  FolderOpen,
  Description,
} from '@mui/icons-material';
import { tauriAPI } from '../utils/tauriBridge';
import { listen } from '@tauri-apps/api/event';

const FileDropZone = ({ onFilesAdded }) => {
  const theme = useTheme();
  const [isDragOver, setIsDragOver] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  // 支持的文件格式
  const supportedExtensions = ['.sp', '.cfg', '.ini', '.txt', '.vmt', '.qc', '.inc', '.lua', '.log', '.vdf', '.scr'];

  // 校验文件格式
  const validateFileFormat = (fileName) => {
    const ext = '.' + fileName.split('.').pop().toLowerCase();
    return supportedExtensions.includes(ext);
  };

  // 显示错误提示
  const showErrorAlert = (message) => {
    setAlertMessage(message);
    setShowAlert(true);
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // 监听 Tauri 的全局拖拽事件（需要在 tauri.conf.json 中配置 windows.fileDropEnabled: true）
  useEffect(() => {
    const unlisten = listen('tauri://file-drop', async (event) => {
      setIsDragOver(false);
      const paths = event.payload; // 这是一个路径数组
      if (!paths || paths.length === 0) return;

      // 这里需要判断路径是文件还是文件夹，我们可以调用 Rust 来扫描
      // 简单起见，我们假设用户可能拖入混合内容
      // 策略：让 Rust 统一处理，传入路径列表，Rust 负责递归扫描文件夹并返回所有有效文件
      // 由于没有直接的 "scanMixedPaths" 接口，我们在 JS 侧简单处理一下

      let allFiles = [];
      // 这里简化处理：因为无法直接在前端判断路径是文件还是文件夹（除非调用 Rust fs.metadata）
      // 建议：直接将路径传给 onFilesAdded，让 MainLayout 或 FileList 统一去获取 Stats 和过滤
      // 但为了保持接口一致，我们这里做一个简单的推断：

      for (const path of paths) {
        const name = path.split(/[\\/]/).pop();
        // 如果有后缀且在支持列表里，大概率是文件
        if (validateFileFormat(name)) {
          allFiles.push({ name, path, isFile: true });
        } else {
          // 假设是文件夹，尝试扫描
          try {
            const scanned = await tauriAPI.scanDirectory(path);
            scanned.forEach(subPath => {
              const subName = subPath.split(/[\\/]/).pop();
              if (validateFileFormat(subName)) {
                allFiles.push({ name: subName, path: subPath, isFile: true });
              }
            });
          } catch (e) {
            // 忽略扫描错误（可能它就是个不支持的文件）
          }
        }
      }

      if (allFiles.length > 0) {
        onFilesAdded(allFiles);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [onFilesAdded]);

  const handleSelectFiles = useCallback(async () => {
    try {
      // Tauri file dialog 允许在调用时设置文件过滤器，但这会阻止用户选择我们不支持的文件。
      // 但为了统一的错误提示，我们还是在前端手动过滤和提示。
      const filePaths = await tauriAPI.selectFiles();
      if (filePaths.length > 0) {
        const validFiles = [];
        const invalidFiles = [];

        filePaths.forEach(path => {
          const fileName = path.split(/[\\/]/).pop(); // 使用正则表达式匹配两种路径分隔符
          if (validateFileFormat(fileName)) {
            validFiles.push({
              path,
              name: fileName,
              isFile: true,
            });
          } else {
            invalidFiles.push(fileName);
          }
        });

        if (invalidFiles.length > 0) {
          const message = `以下文件因格式不受支持被拒绝导入：
${invalidFiles.join(', ')}

支持的文件类型：${supportedExtensions.join(', ')}`;
          showErrorAlert(message);
        }

        if (validFiles.length > 0) {
          onFilesAdded(validFiles);
        }
      }
    } catch (error) {
      console.error('Failed to select files:', error);
    }
  }, [onFilesAdded]);

  const handleSelectFolder = useCallback(async () => {
    try {
      const folderPath = await tauriAPI.selectFolder();
      if (folderPath) {
        const scannedFiles = await tauriAPI.scanDirectory(folderPath);
        const validFiles = [];
        const invalidFiles = [];

        scannedFiles.forEach(path => {
          const fileName = path.split(/[\\/]/).pop(); // 使用正则表达式匹配两种路径分隔符
          if (validateFileFormat(fileName)) {
            validFiles.push({
              path,
              name: fileName,
              isFile: true,
            });
          } else {
            invalidFiles.push(fileName);
          }
        });

        if (invalidFiles.length > 0) {
          const message = `文件夹中以下文件因格式不受支持被拒绝导入：
${invalidFiles.slice(0, 5).join(', ')}${invalidFiles.length > 5 ? '...' : ''}

支持的文件类型：${supportedExtensions.join(', ')}`;
          showErrorAlert(message);
        }

        if (validFiles.length > 0) {
          onFilesAdded(validFiles);
        } else {
          showErrorAlert('所选文件夹中没有找到支持的文件类型。');
        }
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }, [onFilesAdded]);

  return (
    <Paper
      sx={{
        p: 3,
        border: `2px dashed ${isDragOver ? theme.palette.primary.main : alpha(theme.palette.divider, 0.5)}`,
        bgcolor: isDragOver
          ? alpha(theme.palette.primary.main, 0.05)
          : alpha(theme.palette.background.paper, 0.5),
        transition: 'all 0.2s ease-in-out',
        cursor: 'pointer',
        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.02),
          borderColor: theme.palette.primary.main,
        },
      }}
      elevation={1}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      // 注意：Tauri 的 file-drop 事件是全局的，这里的 onDrop 主要是为了阻止浏览器默认行为
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          textAlign: 'center',
        }}
      >
        <CloudUpload
          sx={{
            fontSize: 48,
            color: isDragOver ? 'primary.main' : 'text.secondary',
            transition: 'color 0.2s ease-in-out',
          }}
        />

        <Box>
          <Typography variant="h6" gutterBottom>
            拖拽文件到此处
          </Typography>
          <Typography variant="body2" color="text.secondary">
            支持 .sp, .cfg, .ini, .txt, .vmt, .qc, .inc, .lua, .log, .vdf, .scr 文件
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<Description />}
            onClick={handleSelectFiles}
            size="small"
          >
            选择文件
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderOpen />}
            onClick={handleSelectFolder}
            size="small"
          >
            选择文件夹
          </Button>
        </Box>
      </Box>

      {/* 错误提示 */}
      <Snackbar
        open={showAlert}
        autoHideDuration={6000}
        onClose={() => setShowAlert(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowAlert(false)}
          severity="warning"
          sx={{
            whiteSpace: 'pre-line',
            maxWidth: '500px',
          }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default FileDropZone;