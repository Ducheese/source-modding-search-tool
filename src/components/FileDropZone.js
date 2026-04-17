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
  FileUpload,
  FolderOpen,
  InsertDriveFile,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useFileScanner } from '../hooks/useFileScanner';

/**
 * 文件拖放区域组件
 * 支持拖放文件/文件夹、选择文件、选择文件夹
 */
const FileDropZone = ({ onFilesAdded }) => {
  const theme = useTheme();
  const { t } = useLanguage();

  // 错误提示状态（用于显示多行错误详情）
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  const showErrorAlert = useCallback((message) => {
    setAlertMessage(message);
    setShowAlert(true);
  }, []);

  // 使用文件扫描 hook
  const { selectFiles, selectFolder } = useFileScanner({
    onFilesAdded,
    showErrorAlert,
    t,
  });

  return (
    <Paper
      // 整个大区块支持点击选择文件，使 pointer 光标名正言顺
      onClick={selectFiles}
      sx={{
        p: 3,
        border: '2px dashed',
        borderColor: alpha(theme.palette.divider, 0.5),
        bgcolor: alpha(theme.palette.background.paper, 0.5),
        transition: 'background-color 0.2s ease-in-out, border-color 0.2s ease-in-out',
        cursor: 'pointer',
        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          borderColor: theme.palette.primary.main,
        },
      }}
      elevation={0}
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
        <FileUpload
          sx={{
            fontSize: 48,
            color: 'text.secondary',
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
            startIcon={<InsertDriveFile />}
            onClick={(e) => {
              // 阻止事件冒泡，防止触发外层 Paper 的 onClick
              e.stopPropagation();
              selectFiles();
            }}
            size="small"
          >
            {t('dropzone.selectFiles')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderOpen />}
            onClick={(e) => {
              // 阻止事件冒泡
              e.stopPropagation();
              selectFolder();
            }}
            size="small"
          >
            {t('dropzone.selectFolder')}
          </Button>
        </Box>
      </Box>

      {/* 错误提示（用于显示多行错误详情） */}
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
