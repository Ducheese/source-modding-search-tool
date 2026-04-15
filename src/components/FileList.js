import React, { useState, useEffect, useRef, useMemo, useDeferredValue, memo } from 'react';
import { FixedSizeList as List, areEqual } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  Box,
  Typography,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Chip,
  Tooltip,
  TextField,
  useTheme,
  alpha,
  CircularProgress, // 加上加载指示器
} from '@mui/material';
import {
  Delete,
  ClearAll,
  Folder,
  InsertDriveFile,
  Search,
  Clear,
} from '@mui/icons-material';
import { useSnackbar } from '../contexts/SnackbarContext';
import { tauriAPI } from '../utils/tauriBridge';
import { useLanguage } from '../utils/i18n';

// --- 子组件：单独的文件行 (Memo化以极致性能) ---
const FileRow = memo(({ data, index, style }) => {
  if (!data || !data.files) return null;

  const showSnackbar = useSnackbar();

  const { files, fileStats, onFileRemoved, truncatePath, getEncodingColor, formatFileSize, theme, t } = data;
  const file = files[index];

  // 防御性编程：防止索引越界
  if (!file) return null;

  const stats = (fileStats && fileStats[file.path]) || {};

  // React-window 的 style 必须传给最外层容器，包含 position, top, height, width
  return (
    <div style={style}>
      <ListItem
        component="div"
        disablePadding
        sx={{
          height: '100%',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          px: 2,
          // 悬停效果更明显一点
          transition: 'background-color 0.2s ease-in-out',
          '&:hover': {
            bgcolor: alpha(theme.palette.action.hover, 0.04),
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
          {file.isFile ? (
            <InsertDriveFile sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
          ) : (
            <Folder sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
          )}
        </Box>

        <ListItemText
          // 关键修复：显式告诉 MUI 用 div 来渲染文字容器，别用默认的 p
          primaryTypographyProps={{ component: 'div' }}
          secondaryTypographyProps={{ component: 'div' }}
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </Typography>
              <Chip
                size="small"
                label={stats.encoding || '...'}
                color={getEncodingColor(stats.encoding)}
                variant="outlined"
                sx={{ height: 16, fontSize: '0.6rem', userSelect: 'none' }}   // 编码类型无法选中
              />
            </Box>
          }
          secondary={
            <Box sx={{ mt: 0.5 }}>
              <Tooltip title={file.path} enterDelay={500}>
                <Typography
                  variant="caption"
                  color={theme.palette.text.secondary}
                  sx={{
                    // 不使用衬线字体
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'default',   // 既然不能点，就别显示手型
                    userSelect: 'none',  // 无法选中
                    maxWidth: '90%',     // 防止过宽
                  }}
                >
                  {truncatePath(file.path)}
                </Typography>
              </Tooltip>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <Typography variant="caption" color={theme.palette.text.secondary}>
                  {formatFileSize(stats.size || 0)}
                </Typography>
                <Typography variant="caption" color={theme.palette.text.secondary}>
                  {t('fileList.lines', { lines: stats.lines || 0 })}
                </Typography>
              </Box>
            </Box>
          }
        />

        <ListItemSecondaryAction sx={{ right: 16 }}>
          <Tooltip title={t('fileList.removeTooltip')}>
            <IconButton
              edge="end"
              size="small"
              onClick={() => {
                onFileRemoved(file.path);
                showSnackbar(t('fileList.removed', { name: file.name }), 'warning');
              }}
              sx={{
                color: theme.palette.text.secondary,
                transition: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out',
                '&:hover': { color: 'error.main' }
              }}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </ListItemSecondaryAction>
      </ListItem>
    </div>
  );
}, areEqual);

// 辅助函数
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const truncatePath = (path, maxLength = 40) => {
  if (!path || path.length <= maxLength) return path;
  const parts = path.split(/[\\/]/);
  if (parts.length <= 2) return path;
  return '…\\' + parts[parts.length - 2] + '\\' + parts[parts.length - 1];
};

const getEncodingColor = (encoding) => {
  // 1. 预处理：确保是小写，并移除可能干扰精确匹配的常见后缀（如 ' with BOM'）
  const cleanEncoding = encoding?.toLowerCase().replace(/ with bom/i, '');

  switch (cleanEncoding) {
    // 通用/推荐编码 (Success)
    case 'utf-8':
    case 'utf8': // 兼容 utf8 (无连字符)
    case 'ascii':
      return 'success';

    // 区域/遗留编码 (Warning)
    case 'gbk':
    case 'gb2312':
    case 'gb18030': // 增加对更现代的国标支持
      return 'warning';

    // 特殊/复杂编码 (Info)
    case 'utf-16':
    case 'utf-16le':
    case 'utf-16be':
      return 'info';

    default:
      // 如果后端能返回更广泛的编码，且想将它们都标记为 Warning (潜在乱码风险)
      // 可以增加一个兜底的包含判断，例如将所有 'windows-' 或 'shift-jis' 归为 warning
      if (cleanEncoding && (cleanEncoding.includes('windows-') || cleanEncoding.includes('shift-jis'))) {
        return 'warning';
      }
      return 'default';
  }
};

// --- 主组件 ---
const FileList = ({ files, onFileRemoved, onClearFiles }) => {
  const showSnackbar = useSnackbar();
  const theme = useTheme();
  const { t } = useLanguage();

  // 状态管理
  const [fileStats, setFileStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(false); // 加载状态
  const [searchQuery, setSearchQuery] = useState('');

  // 关键优化：使用 useDeferredValue。
  // 这意味着 deferredQuery 的更新会比 searchQuery 稍慢一点点，
  // 从而让 UI（输入框）保持响应，而列表过滤在后台进行。
  const deferredQuery = useDeferredValue(searchQuery);

  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const listRef = useRef(null);
  const searchInputRef = useRef(null);

  // 批量获取文件统计信息 - 这里的性能提升是巨大的
  useEffect(() => {
    const fetchFileStats = async () => {
      if (files.length === 0) {
        setFileStats({});
        return;
      }

      // 找出新增的还没有统计信息的文件
      const pathsToFetch = files
        .map(f => f.path)
        .filter(path => !fileStats[path]);

      if (pathsToFetch.length === 0) return;

      setLoadingStats(true);
      try {
        // 分批处理，防止IPC阻塞
        const CHUNK_SIZE = 500;
        const allStats = {};

        for (let i = 0; i < pathsToFetch.length; i += CHUNK_SIZE) {
          const chunk = pathsToFetch.slice(i, i + CHUNK_SIZE);
          const statsArray = await tauriAPI.getFileStatsBatch(chunk);
          // 收集结果，不立即 setState
          statsArray.forEach(stat => {
            allStats[stat.path] = stat;
          });
        }

        // 最后一次性更新
        setFileStats(prev => ({ ...prev, ...allStats }));
      } catch (error) {
        console.error('Failed to get stats batch:', error);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchFileStats();
  }, [files]);


  // 过滤逻辑：使用 deferredQuery 而不是直接的 searchQuery
  const filteredFiles = useMemo(() => {
    if (!deferredQuery) return files;
    const lowerQuery = deferredQuery.toLowerCase();
    return files.filter(file => file.name.toLowerCase().includes(lowerQuery));
  }, [files, deferredQuery]);

  const totalSize = files.reduce((sum, file) => sum + (fileStats[file.path]?.size || 0), 0);
  const totalLines = files.reduce((sum, file) => sum + (fileStats[file.path]?.lines || 0), 0);

  const itemData = useMemo(() => ({
    files: filteredFiles,
    fileStats,
    onFileRemoved,
    truncatePath,
    getEncodingColor,
    formatFileSize,
    theme,
    t,
  }), [filteredFiles, fileStats, onFileRemoved, theme, t]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题和统计 */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="700">
              {t('fileList.title', { count: files.length })}
            </Typography>
            {loadingStats && <CircularProgress size={16} />}
          </Box>

          {files.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ClearAll />}
              onClick={() => {
                onClearFiles();
                setFileStats({});
                showSnackbar(t('fileList.cleared'), 'warning');
              }}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              {t('fileList.clear')}
            </Button>
          )}
        </Box>

        {files.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {/* 统计信息 */}
              <Chip size="small" label={t('fileList.totalSize', { size: formatFileSize(totalSize) })} />
              <Chip size="small" label={t('fileList.totalLines', { lines: totalLines.toLocaleString() })} />

              {/* 未聚焦时显示的搜索框 */}
              {!isSearchFocused && (
                <Chip
                  size="small"
                  icon={<Search sx={{ fontSize: 16 }} />}
                  label={searchQuery || t('fileList.searchChip')}
                  onClick={() => {
                    setIsSearchFocused(true);
                    // 延迟聚焦，等待 UI 渲染
                    setTimeout(() => searchInputRef.current?.focus(), 150);
                  }}
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    // bgcolor: 'transparent',
                    // border: `1px solid ${theme.palette.divider}`,
                  }}
                />
              )}
            </Box>

            {/* 聚焦时显示的搜索框 */}
            {isSearchFocused && (
              <TextField
                inputRef={searchInputRef}
                placeholder={t('fileList.searchPlaceholder')}
                variant="outlined"
                size="small"
                fullWidth
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => {
                  // 延迟设置状态，给其他点击事件（如清除按钮）一个处理时间
                  setTimeout(() => {
                    // 检查搜索框是否确实应该失焦
                    // 可以在这里加一个 ref 判断，但为了简洁，只用 setTimeout
                    setIsSearchFocused(false);
                  }, 150); // 150ms 是一个常用且体验较好的值
                }}
                InputProps={{
                  startAdornment: (
                    <Search sx={{ color: theme.palette.text.secondary, mr: 1 }} />
                  ),
                  // 如果需要清除按钮，可以在这里添加一个 IconButton
                  endAdornment: searchQuery && (
                    <IconButton
                      size="small"
                      onClick={() => setSearchQuery('')}
                      sx={{ color: theme.palette.text.secondary }}
                    >
                      <Clear fontSize="small" />
                    </IconButton>
                  )
                }}
              />
            )}

            {/* 显示过滤结果数量，作为反馈 */}
            {searchQuery && (
              <Typography fontSize="small" variant="caption" color={theme.palette.text.secondary} sx={{ ml: 0.5 }}>
                {t('fileList.filtered', { count: filteredFiles.length })}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* 虚拟化列表区域 */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {filteredFiles.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: theme.palette.text.secondary,
              p: 3,
            }}
          >
            <Typography variant="h6">
              {files.length === 0 ? t('fileList.emptyTitle') : t('fileList.noMatchTitle')}
            </Typography>
            <Typography variant="body2">
              {files.length === 0 ? t('fileList.emptyHint') : null}
            </Typography>
          </Box>
        ) : (
          <AutoSizer>
            {({ height, width }) => {
              // 防御：防止 height 为 0 导致报错
              if (height === 0 || width === 0) {
                return null;
              }
              return (
                <List
                  ref={listRef}
                  height={height}
                  width={width}
                  itemCount={filteredFiles.length}
                  itemSize={80} // ListItem 的高度，需要和 CSS 一致
                  itemData={itemData}
                >
                  {FileRow}
                </List>
              );
            }}
          </AutoSizer>
        )}
      </Box>
    </Box>
  );
};

export default FileList;