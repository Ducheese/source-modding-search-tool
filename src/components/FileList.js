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
  Autocomplete,
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
} from '@mui/icons-material';
import { useSnackbar } from '../App';
import { tauriAPI } from '../utils/tauriBridge'; // 使用新的 Bridge

// --- 子组件：单独的文件行 (Memo化以极致性能) ---
const FileRow = memo(({ data, index, style }) => {
  if (!data || !data.files) return null;

  const showSnackbar = useSnackbar();

  const { files, fileStats, highlightedFile, onFileRemoved, truncatePath, getEncodingColor, formatFileSize, theme } = data;
  const file = files[index];

  // 防御性编程：防止索引越界
  if (!file) return null;

  const stats = (fileStats && fileStats[file.path]) || {};
  const isHighlighted = highlightedFile === file.path;

  // React-window 的 style 必须传给最外层容器，包含 position, top, height, width
  return (
    <div style={style}>
      <ListItem
        component="div"
        disablePadding
        sx={{
          height: '100%',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
          px: 2,
          '&:hover': {
            bgcolor: alpha(theme.palette.action.hover, 0.04),
          },
          ...(isHighlighted && {
            bgcolor: alpha(theme.palette.primary.main, 0.15),
            borderLeft: `3px solid ${theme.palette.primary.main}`,
            transition: 'all 0.3s ease',
          }),
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
              <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </Typography>
              <Chip
                size="small"
                label={stats.encoding || '...'}
                color={getEncodingColor(stats.encoding)}
                variant="outlined"
                sx={{ height: 16, fontSize: '0.6rem' }}
              />
            </Box>
          }
          secondary={
            <Box sx={{ mt: 0.5 }}>
              <Tooltip title={file.path} placement="top" enterDelay={500}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontFamily: 'monospace',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'default', // 既然不能点，就别显示手型
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
        />

        <ListItemSecondaryAction sx={{ right: 16 }}>
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
    </div>
  );
}, areEqual);

// --- 主组件 ---
const FileList = ({ files, onFileRemoved, onClearFiles }) => {
  const showSnackbar = useSnackbar();
  const theme = useTheme();

  // 状态管理
  const [fileStats, setFileStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(false); // 加载状态
  const [searchQuery, setSearchQuery] = useState('');

  // 关键优化：使用 useDeferredValue。
  // 这意味着 deferredQuery 的更新会比 searchQuery 稍慢一点点，
  // 从而让 UI（输入框）保持响应，而列表过滤在后台进行。
  const deferredQuery = useDeferredValue(searchQuery);

  const [highlightedFile, setHighlightedFile] = useState(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);

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
        for (let i = 0; i < pathsToFetch.length; i += CHUNK_SIZE) {
          const chunk = pathsToFetch.slice(i, i + CHUNK_SIZE);
          const statsArray = await tauriAPI.getFileStatsBatch(chunk);
          setFileStats(prev => {
            const newStats = { ...prev };
            statsArray.forEach(stat => {
              newStats[stat.path] = stat;
            });
            return newStats;
          });
        }
      } catch (error) {
        console.error('Failed to get stats batch:', error);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchFileStats();
  }, [files]);

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
    return '...\\' + parts[parts.length - 2] + '\\' + parts[parts.length - 1];
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

  // 过滤逻辑：使用 deferredQuery 而不是直接的 searchQuery
  const filteredFiles = useMemo(() => {
    if (!deferredQuery) return files;
    const lowerQuery = deferredQuery.toLowerCase();
    return files.filter(file => file.name.toLowerCase().includes(lowerQuery));
  }, [files, deferredQuery]);

  // 虚拟列表定位
  const scrollToFile = (filePath) => {
    // 在过滤后的列表中查找索引
    const index = filteredFiles.findIndex(f => f.path === filePath);
    if (index !== -1 && listRef.current) {
      listRef.current.scrollToItem(index, 'center');
      setHighlightedFile(filePath);
      setTimeout(() => setHighlightedFile(null), 3000);
    }
  };

  const totalSize = files.reduce((sum, file) => sum + (fileStats[file.path]?.size || 0), 0);
  const totalLines = files.reduce((sum, file) => sum + (fileStats[file.path]?.lines || 0), 0);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 标题和统计 */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              文件列表 ({files.length})
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
                setFileStats({}); // 清空统计
                showSnackbar('已清空所有文件', 'warning');
              }}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              清空
            </Button>
          )}
        </Box>

        {files.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* 第一行：统计信息 */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`总大小: ${formatFileSize(totalSize)}`} />
              <Chip size="small" label={`总行数: ${totalLines.toLocaleString()}`} />
              {/* 未聚焦时显示的搜索框 */}
              {!isSearchFocused && (
                <Chip
                  size="small"
                  icon={<Search sx={{ fontSize: 16 }} />}
                  label={searchQuery || '搜索文件...'}
                  onClick={() => {
                    setIsSearchFocused(true);
                    setIsAutocompleteOpen(true);
                    // 延迟聚焦，等待 UI 渲染
                    setTimeout(() => searchInputRef.current?.focus(), 50);
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
              <Autocomplete
                autoFocus
                open={isAutocompleteOpen}
                onOpen={() => setIsAutocompleteOpen(true)}
                onClose={(event, reason) => {
                  // 检查关闭原因。'escape' 或 'blur'（外部点击）通常是关闭的原因。
                  // 如果我们想要保留过滤状态，可以只处理下拉列表的关闭。
                  // 但是，为了防止点击输入框本身时关闭搜索模式，我们保持 Autocomplete 组件的聚焦状态（isSearchFocused=true）。
                  
                  // 只有在用户明确通过 ESC 或点击外部来退出时，才完全关闭搜索模式。
                  // 对于一般的失去焦点（如点击输入框），我们只关闭下拉列表。
                  if (reason === 'escape' || reason === 'blur') {
                      // 仅当 reason 为 'blur' 或 'escape' 时，才将 isSearchFocused 设为 false，
                      // 否则，保持它为 true，这样即使下拉框关闭了，搜索框本身还在。
                      setIsAutocompleteOpen(false); // 关闭下拉列表
                      setIsSearchFocused(false); // 完全退出搜索模式
                  } else {
                      // 对于其他原因（如选择选项或手动点击输入框），我们只关闭下拉列表
                      setIsAutocompleteOpen(false);
                  }
                }}
                size="small"
                // 关键优化：如果文件太多，Autocomplete 的下拉渲染会卡死
                // 限制下拉显示的选项数量，或者干脆当文件 > 2000 时不显示下拉建议，只做过滤
                options={filteredFiles.length > 2000 ? [] : filteredFiles}
                getOptionLabel={(option) => option.name || option}
                inputValue={searchQuery}
                onInputChange={(e, value) => setSearchQuery(value)}
                onChange={(e, value) => {
                  if (value) scrollToFile(value.path);
                }}
                // 优化：自定义 Listbox，防止一次性渲染过多 DOM (MUI Autocomplete 默认也是虚拟化的，但数据量大时仍有开销)
                renderInput={(params) => (
                  <TextField
                    {...params}
                    inputRef={searchInputRef}
                    placeholder="搜索文件..."
                    variant="outlined"
                    size="small"
                    fullWidth
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <Search sx={{ color: 'text.secondary', mr: 1 }} />
                          {params.InputProps.startAdornment}
                        </>
                      ),
                      endAdornment: null,
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {option.isFile ? (
                      <InsertDriveFile sx={{ fontSize: 16, color: 'text.secondary' }} />
                    ) : (
                      <Folder sx={{ fontSize: 16, color: 'text.secondary' }} />
                    )}
                    <Typography variant="body2" noWrap>{option.name}</Typography>
                  </Box>
                )}
                noOptionsText={filteredFiles.length > 0 ? "请输入更精确的关键词" : "没有匹配的文件"}
              />
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
              color: 'text.secondary',
              p: 3,
            }}
          >
            <InsertDriveFile sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography>
              {files.length === 0 ? "暂无文件" : "没有找到匹配的文件"}
            </Typography>
            {files.length === 0 && (
              <Typography variant="body2" align="center">
                拖拽文件或使用上方按钮添加文件
              </Typography>
            )}
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
                  itemSize={72} // ListItem 的高度，需要和 CSS 一致
                  itemData={{
                    files: filteredFiles, // 传入过滤后的文件
                    fileStats,
                    highlightedFile,
                    onFileRemoved,
                    truncatePath,
                    getEncodingColor,
                    formatFileSize,
                    theme
                  }}
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