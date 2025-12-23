import React, { useCallback, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CloudUpload,
  FolderOpen,
  Description,
} from '@mui/icons-material';

const FileDropZone = ({ onFilesAdded }) => {
  const theme = useTheme();
  const [isDragOver, setIsDragOver] = useState(false);

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

    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          if (entry.isFile) {
            const file = item.getAsFile();
            files.push({
              name: file.name,
              path: file.path,
              size: file.size,
              isFile: true,
            });
          } else if (entry.isDirectory) {
            // 处理文件夹拖拽
            const dirPath = entry.fullPath;
            try {
              const scannedFiles = await window.electronAPI.scanDirectory(dirPath);
              const fileObjects = scannedFiles.map(filePath => ({
                path: filePath,
                name: filePath.split(/[\/]/).pop(),
                isFile: true,
              }));
              files.push(...fileObjects);
            } catch (error) {
              console.error('Failed to scan directory:', error);
            }
          }
        }
      }
    }

    if (files.length > 0) {
      onFilesAdded(files);
    }
  }, [onFilesAdded]);

  const handleSelectFiles = useCallback(async () => {
    try {
      const filePaths = await window.electronAPI.selectFiles();
      if (filePaths.length > 0) {
        const files = filePaths.map(path => ({
          path,
          name: path.split(/[\/]/).pop(),
          isFile: true,
        }));
        onFilesAdded(files);
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
        const files = scannedFiles.map(path => ({
          path,
          name: path.split(/[\/]/).pop(),
          isFile: true,
        }));
        onFilesAdded(files);
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
    </Paper>
  );
};

export default FileDropZone;