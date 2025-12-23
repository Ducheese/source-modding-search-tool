import React, { useCallback, useState } from 'react';
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

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const items = Array.from(e.dataTransfer.items);
    const files = [];
    const invalidFiles = [];

    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          if (entry.isFile) {
            const file = item.getAsFile();
            if (validateFileFormat(file.name)) {
              files.push({
                name: file.name,
                path: file.path,
                size: file.size,
                isFile: true,
              });
            } else {
              invalidFiles.push(file.name);
            }
          } else if (entry.isDirectory) {
            // 处理文件夹拖拽
            const dirPath = entry.fullPath;
            try {
              const scannedFiles = await window.electronAPI.scanDirectory(dirPath);
              const validFiles = [];
              const invalidFilesInDir = [];
              
              scannedFiles.forEach(filePath => {
                const fileName = filePath.split(/[\\/]/).pop(); // 使用正则表达式匹配两种路径分隔符
                if (validateFileFormat(fileName)) {
                  validFiles.push({
                    path: filePath,
                    name: fileName,
                    isFile: true,
                  });
                } else {
                  invalidFilesInDir.push(fileName);
                }
              });
              
              files.push(...validFiles);
              if (invalidFilesInDir.length > 0) {
                invalidFiles.push(...invalidFilesInDir.slice(0, 3)); // 只显示前3个无效文件名
              }
            } catch (error) {
              console.error('Failed to scan directory:', error);
            }
          }
        }
      }
    }

    if (invalidFiles.length > 0) {
      const message = `以下文件因格式不受支持被拒绝导入：
${invalidFiles.join(', ')}${invalidFiles.length >= 3 ? '...' : ''}

支持的文件类型：${supportedExtensions.join(', ')}`;
      showErrorAlert(message);
    }

    if (files.length > 0) {
      onFilesAdded(files);
    } else if (invalidFiles.length === 0) {
      showErrorAlert('未找到有效的文件。请确保拖拽的是支持的文件类型。');
    }
  }, [onFilesAdded]);

  const handleSelectFiles = useCallback(async () => {
    try {
      const filePaths = await window.electronAPI.selectFiles();
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
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        const scannedFiles = await window.electronAPI.scanDirectory(folderPath);
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
    >
      <Box
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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