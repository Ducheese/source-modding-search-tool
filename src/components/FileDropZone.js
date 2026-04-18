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
import { useWindowFileDrop } from '../hooks/useWindowFileDrop';

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

  const {
    selectFiles,
    selectFolder,
    handleDroppedPaths,
    isBusy,
  } = useFileScanner({
    onFilesAdded,
    showErrorAlert,
    t,
  });

  const { isFileDragActive } = useWindowFileDrop({
    onDrop: handleDroppedPaths,
  });

  return (
    <Paper
      sx={{
        p: 3,
        border: '2px dashed',
        borderColor: isFileDragActive
          ? theme.palette.primary.main
          : alpha(theme.palette.divider, 0.5),
        bgcolor: isFileDragActive
          ? alpha(theme.palette.primary.main, 0.06)
          : alpha(theme.palette.background.paper, 0.5),
        transition: 'background-color 0.2s ease-in-out, border-color 0.2s ease-in-out',

        // 拖拽时的呼吸光晕动画
        ...(isFileDragActive && {
          animation: 'breathingGlow 1.5s infinite ease-in-out',
          '@keyframes breathingGlow': {
            '0%': {
              boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.4)}`
            },
            '50%': {
              boxShadow: `0 0 0 15px ${alpha(theme.palette.primary.main, 0)}`
            },
            '100%': {
              boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0)}`
            }
          }
        }),

        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          borderColor: theme.palette.primary.main,
        },
      }}
      elevation={0}
    >
      {/* 主内容区：大面积可点击，触发 selectFiles */}
      <Box
        onClick={isBusy ? undefined : selectFiles}
        sx={{
          display: 'flex',
          gap: 2,
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          pt: 1,
          pb: 2,
          cursor: isBusy ? 'default' : 'pointer',
        }}
      >
        <FileUpload
          sx={{
            fontSize: 48,
            color: isFileDragActive ? 'primary.main' : 'text.secondary',
            transition: 'color 0.2s ease-in-out',

            // 拖拽时的图标弹跳动画
            ...(isFileDragActive && {
              animation: 'bounceIcon 1s infinite ease-in-out',
              '@keyframes bounceIcon': {
                '0%, 100%': { transform: 'translateY(0)' },
                '50%': { transform: 'translateY(-10px)' }
              }
            })
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

        {/* 显式操作按钮 */}
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
            onClick={(e) => { e.stopPropagation(); selectFiles(); }}
            size="small"
            disabled={isBusy}
          >
            {t('dropzone.selectFiles')}
          </Button>

          <Button
            variant="outlined"
            startIcon={<FolderOpen />}
            onClick={(e) => { e.stopPropagation(); selectFolder(); }}
            size="small"
            disabled={isBusy}
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
