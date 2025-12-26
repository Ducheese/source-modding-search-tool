import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Chip,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Delete,
  ClearAll,
  Folder,
  InsertDriveFile,
} from '@mui/icons-material';
import { useSnackbar } from '../App';

const FileList = ({ files, onFileRemoved, onClearFiles }) => {
  const showSnackbar = useSnackbar();
  const theme = useTheme();
  const [fileStats, setFileStats] = useState({});

  // 获取文件统计信息
  useEffect(() => {
    const fetchFileStats = async () => {
      const stats = {};
      for (const file of files) {
        try {
          const stat = await window.electronAPI.getFileStats(file.path);
          stats[file.path] = stat;
        } catch (error) {
          console.error(`Failed to get stats for ${file.path}:`, error);
          stats[file.path] = { size: 0, lines: 0, encoding: 'Unknown' };
        }
      }
      setFileStats(stats);
    };

    if (files.length > 0) {
      fetchFileStats();
    } else {
      setFileStats({});
    }
  }, [files]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const truncatePath = (path, maxLength = 40) => {
    if (path.length <= maxLength) return path;
    const parts = path.split(/[\\/]/);
    if (parts.length <= 2) return path;
    
    // 至少保留文件名和上级文件夹
    const filename = parts[parts.length - 1];
    const parentFolder = parts[parts.length - 2];
    
    // 计算省略后的路径
    const remainingParts = parts.slice(0, -2); // 移除最后两部分（文件夹和文件名）
    const ellipsis = remainingParts.length > 0 ? '...\\' : '';
    
    return ellipsis + parentFolder + '\\' + filename;
  };

  const getEncodingColor = (encoding) => {
    switch (encoding?.toLowerCase()) {
      case 'utf-8':
      case 'ascii':
        return 'success';
      case 'gbk':
      case 'gb2312':
        return 'warning';
      case 'utf-16':
      case 'utf-16le':
      case 'utf-16be':
        return 'info';
      default:
        return 'default';
    }
  };

  const totalSize = files.reduce((sum, file) => sum + (fileStats[file.path]?.size || 0), 0);
  const totalLines = files.reduce((sum, file) => sum + (fileStats[file.path]?.lines || 0), 0);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题和统计 */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            文件列表 ({files.length})
          </Typography>
          {files.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ClearAll />}
              onClick={() => {
                onClearFiles();
                showSnackbar('已清空所有文件', 'warning');
              }}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              清空
            </Button>
          )}
        </Box>
        
        {files.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`总大小: ${formatFileSize(totalSize)}`} />
            <Chip size="small" label={`总行数: ${totalLines.toLocaleString()}`} />
          </Box>
        )}
      </Box>

      {/* 文件列表 */}
      <Box sx={{ flex: 1, overflowX: 'hidden', overflowY: 'auto', maxHeight: 'calc(100vh)',
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 
          theme.palette.mode === 'dark'   // 滚动条滑块的颜色
          ? 'rgba(255, 255, 255, 0.2)'  // 暗色模式
          : 'rgba(0, 0, 0, 0.2)',       // 浅色模式
          borderRadius: '10px', // 滑块圆角
        },
        '&::-webkit-scrollbar-thumb:hover': {
          backgroundColor: 
          theme.palette.mode === 'dark'   // 鼠标悬停时颜色加深
          ? 'rgba(255, 255, 255, 0.3)'  // 暗色模式
          : 'rgba(0, 0, 0, 0.3)',       // 浅色模式
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'transparent', // 滚动条轨道的颜色（通常设为透明）
        },
      }}>
        {files.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'text.secondary',
              p: 3,
            }}
          >
            <InsertDriveFile sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body1" gutterBottom>
              暂无文件
            </Typography>
            <Typography variant="body2" align="center">
              拖拽文件或使用上方按钮添加文件
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ p: 0 }}>
            {files.map((file, index) => {
              const stats = fileStats[file.path] || {};
              return (
                <ListItem
                  key={`${file.path}-${index}`}
                  sx={{
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.action.hover, 0.04),
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                    {file.isFile ? (
                      <InsertDriveFile sx={{ color: 'text.secondary', fontSize: 20 }} />
                    ) : (
                      <Folder sx={{ color: 'text.secondary', fontSize: 20 }} />
                    )}
                  </Box>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {file.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={stats.encoding || 'Unknown'}
                          color={getEncodingColor(stats.encoding)}
                          variant="outlined"
                          sx={{ height: 16, fontSize: '0.6rem' }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Tooltip 
                          title={file.path} 
                          placement="top"
                          arrow
                          enterDelay={500}
                          leaveDelay={100}
                        >
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ 
                              fontFamily: 'monospace',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                            }}
                          >
                            {truncatePath(file.path)}
                          </Typography>
                        </Tooltip>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(stats.size || 0)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {stats.lines || 0} 行
                          </Typography>
                        </Box>
                      </Box>
                    }
                    sx={{ my: 1 }}
                  />
                  
                  <ListItemSecondaryAction>
                    <Tooltip title="删除">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => {
                          onFileRemoved(file.path);
                          showSnackbar(`已删除文件: ${file.name}`, 'warning');
                        }}
                        sx={{ 
                          color: 'text.secondary',
                          '&:hover': { color: 'error.main' }
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default FileList;