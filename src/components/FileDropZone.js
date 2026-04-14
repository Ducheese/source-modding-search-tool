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
import { useLanguage } from '../utils/i18n';
import { useFileScanner } from '../hooks/useFileScanner';

/**
 * 文件拖放区域组件
 * 支持拖放文件/文件夹、选择文件、选择文件夹
 */
const FileDropZone = ({ onFilesAdded }) => {
  const theme = useTheme();
  const { t } = useLanguage();

  // 错误提示状态
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  const showErrorAlert = useCallback((message) => {
    setAlertMessage(message);
    setShowAlert(true);
  }, []);

  // 使用文件扫描 hook
  const { selectFiles, selectFolder, isDragOver, setIsDragOver } = useFileScanner({
    onFilesAdded,
    showErrorAlert,
    t,
  });

  // 文件拖放事件处理
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, [setIsDragOver]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, [setIsDragOver]);

  return (
    <Paper
      sx={{
        p: 3,
        border: `2px dashed ${isDragOver ? theme.palette.primary.main : alpha(theme.palette.divider, 0.5)}`,
        bgcolor: isDragOver
          ? alpha(theme.palette.primary.main, 0.05)
          : alpha(theme.palette.background.paper, 0.5),
        transition: 'background-color 0.2s ease-in-out, border-color 0.2s ease-in-out',
        cursor: 'pointer',
        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.02),
          borderColor: theme.palette.primary.main,
        },
      }}
      elevation={0}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      // Tauri 的 file-drop 事件是全局的，这里的 onDrop 主要是阻止浏览器默认行为
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          pt: 1,
          pb: 2,
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
            {t('dropzone.dragHint')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dropzone.supportHint')}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Button
            variant="contained"
            startIcon={<Description />}
            onClick={selectFiles}
            size="small"
          >
            {t('dropzone.selectFiles')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderOpen />}
            onClick={selectFolder}
            size="small"
          >
            {t('dropzone.selectFolder')}
          </Button>
        </Box>
      </Box>

      {/* 错误提示 */}
      <Snackbar
        open={showAlert}
        autoHideDuration={4000}
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
