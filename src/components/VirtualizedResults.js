import React, { useRef, useMemo, memo, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Box, Typography, IconButton, Chip, useTheme, alpha } from '@mui/material';
import { ExpandMore, ExpandLess, CopyAll, FileOpen } from '@mui/icons-material';
import { VariableSizeList as List, areEqual } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useSnackbar } from '../App';
import { tauriAPI } from '../utils/tauriBridge';
import ResultLine from './ResultLine';
import { useLanguage } from '../utils/i18n';

// 注入跑马灯动画样式
// 技巧：移动 -50% 距离，前提是内容也是双倍的
const marqueeStyles = `
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.marquee-content {
  animation: marquee 10s linear infinite;
}
`;

// --- 提取出的原子组件：跑马灯 (Marquee) ---
// 技巧：使用负的 animation-delay 基于 Date.now() 进行全局同步
// 这样无论组件何时挂载，它们的动画位置都相对于"绝对时间"是同步的，不会重置
const FileMarquee = memo(({ path, onCopy }) => {
  const { t } = useLanguage();
  const getSyncedDelay = () => {
    const duration = 10;
    const now = Date.now() / 1000;
    return -(now % duration);
  };

  return (
    <Box
      sx={{
        ml: 1,
        flex: 1,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',   // 稍微加个渐变遮罩
        cursor: 'pointer',
        opacity: 0.7,
        '&:hover': { opacity: 1 },
      }}
      title={t('result.copyPath')}
      onClick={onCopy}
    >
      {/* ⭐️ 跑马灯 Wrapper：包含两份内容，宽度 fit-content */}
      <Box
        className="marquee-content"
        sx={{
          display: 'flex',
          width: 'fit-content',
          // 关键点：动态设置 delay，让动画"看起来"从没断过
          animationDelay: `${getSyncedDelay()}s`
        }}
      >
        {/* 第一份内容 */}
        <Typography variant="caption" color="text.secondary" sx={{ pr: 32 }}>
          {path}
        </Typography>
        {/* 第二份内容 (克隆体) */}
        <Typography variant="caption" color="text.secondary" sx={{ pr: 32 }}>
          {path}
        </Typography>
      </Box>
    </Box>
  );
});

// --- 提取出的行组件：Row ---
// 必须定义在主组件外部，保证引用稳定
const Row = memo(({ data, index, style }) => {
  const { flatRows, toggleFile, theme, showSnackbar, t } = data;
  const row = flatRows[index];

  // 1. 分隔区域
  if (row.type === 'separator') {
    // 获取下一行数据（注意边界检查）
    const nextRow = flatRows[index + 1];
    // 判断下一行是否存在且是否为 header
    const isNextHeader = nextRow && nextRow.type === 'header';

    return (
      <Box
        style={style}
        sx={{
          // 这里可以加一条虚线，或者只是留白
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderBottom: isNextHeader ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          width: '100%',
          height: '100%',
        }}
      />
    );
  }

  // 2. 文件头
  if (row.type === 'header') {
    const { file, isExpanded, isLast, isFirst } = row;

    // 辅助动作
    const handleCopyPath = () => {
      navigator.clipboard.writeText(file.path);
      showSnackbar(t('result.pathCopied'), 'success');
    };

    const handleCopyContent = async () => {
      try {
        const { content } = await tauriAPI.readFile(file.path);
        navigator.clipboard.writeText(content);
        showSnackbar(t('result.contentCopied'), 'success');
      } catch (error) {
        console.error('Failed to copy file content:', error);
        showSnackbar(t('result.contentCopyFailed'), 'error');
      }
    };

    return (
      <Box
        style={style}
        sx={{
          px: 2,
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box',
          borderTop: isFirst ? 'none' : `1px solid ${theme.palette.divider}`,   // 顶部边框常驻
          borderBottom: isExpanded || isLast ? `1px solid ${theme.palette.divider}` : 'none',   // 底部边框条件渲染
        }}
      >
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleFile(file.path, index); }} sx={{ mr: 1 }}>
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', mr: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: '700', whiteSpace: 'nowrap' }}>
            {file.name}
          </Typography>
          {/* 使用提取出的跑马灯组件 */}
          <FileMarquee path={file.path} onCopy={handleCopyPath} />
        </Box>

        <Chip size="small" label={`${file.matches.length}`} color="primary" sx={{ height: 20, mr: 2, userSelect: 'none' }} />

        {/* 工具栏 */}
        <IconButton size="small" title={t('result.copyContent')} onClick={handleCopyContent}>
          <CopyAll fontSize="small" />
        </IconButton>
        <IconButton size="small" title={t('result.openExternal')} onClick={() => tauriAPI.openFileExternally(file.path)}>
          <FileOpen fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  // 3. 代码行渲染 (Match or Context)
  const isMatch = row.type === 'match';

  // 辅助函数：将片段或字符串转为纯文本以供复制
  const getRawText = () => {
    if (typeof row.content === 'string') return row.content;
    if (Array.isArray(row.content)) return row.content.map(s => s.text).join('');
    return '';
  };

  return (
    <div style={style}>
      <ResultLine
        lineNumber={row.lineNumber}
        content={row.content}
        isMatch={isMatch}
        onCopy={() => {
          navigator.clipboard.writeText(getRawText());
          showSnackbar(t('result.lineCopied'), 'success');
        }}
      />
    </div>
  );
}, areEqual); // 使用 react-window 的 areEqual 进行性能优化


// --- 主组件（受控）---
// expandedFiles 和 onToggleFile 由父组件控制
const VirtualizedResults = memo(forwardRef(({ results, expandedFiles, onToggleFile }, ref) => {
  const theme = useTheme();
  const showSnackbar = useSnackbar();
  const { t } = useLanguage();
  const listRef = useRef(null);

  // 暴露给父组件的 API：用于在 setState 前预清缓存
  useImperativeHandle(ref, () => ({
    invalidateFrom(index = 0) {
      listRef.current?.resetAfterIndex(index, false);
    },
  }), []);

  // 常量定义
  const HEADER_HEIGHT = 48;   // 文件头的高度，稍微调小一点，更精致
  const ROW_HEIGHT = 32;   // 和 ResultLine 里的保持一致
  const SEPARATOR_HEIGHT = 16;   // 分隔区域的高度

  // --- 数据展平：第一层 ---
  // 只依赖 results，缓存每个文件的 match/context/separator 行
  // toggle 展开折叠不会触发此层重建
  const matchRowsMap = useMemo(() => {
    if (!results?.files) return new Map();
    const map = new Map();
    results.files.forEach(file => {
      const rows = [];
      file.matches.forEach(match => {
        // 上下文 (Before)
        if (match.context.before?.length > 0) {
          const startLine = match.line_number - match.context.before.length;
          match.context.before.forEach((content, idx) => {
            rows.push({ type: 'context', content, lineNumber: startLine + idx });
          });
        }

        // 匹配本身 (Match)
        rows.push({ type: 'match', content: match.segments, lineNumber: match.line_number });

        // 上下文 (After)
        if (match.context.after?.length > 0) {
          match.context.after.forEach((content, idx) => {
            rows.push({ type: 'context', content, lineNumber: match.line_number + 1 + idx });
          });
        }

        // ⭐️ 注入分隔区域 (Separator)
        rows.push({ type: 'separator' });
      });
      map.set(file.path, rows);
    });
    return map;
  }, [results]); // ← 不依赖 expandedFiles

  // --- 数据展平：第二层 ---
  // 只做 header 组装 + 引用拼接，match 行直接取上层缓存
  // toggle 时只重跑 O(N files) 的遍历，不重建任何 match 行对象
  const flatRows = useMemo(() => {
    if (!results?.files) return [];
    const rows = [];
    results.files.forEach((file, index) => {
      rows.push({
        type: 'header', file,
        isExpanded: expandedFiles.has(file.path),
        isFirst: index === 0,
        isLast: index === results.files.length - 1,
      });
      if (expandedFiles.has(file.path)) {
        const cached = matchRowsMap.get(file.path);
        if (cached) rows.push(...cached);
      }
    });
    return rows;
  }, [results, expandedFiles, matchRowsMap]);

  // --- 单文件展开/收纳：预 invalidate 缓存 ---
  // 在触发 state 更新前先清掉缓存（不强制 forceUpdate）
  // 这样下个 render 直接用干净缓存算布局，避免二次渲染
  const handleToggleFile = useCallback((path, headerIndex) => {
    listRef.current?.resetAfterIndex(headerIndex, false);
    onToggleFile(path);
  }, [onToggleFile]);

  // --- 根据type决定行高 ---
  const getItemSize = (index) => {
    const row = flatRows[index];
    if (row.type === 'header') return HEADER_HEIGHT;
    if (row.type === 'separator') return SEPARATOR_HEIGHT;   // 返回分隔线高度
    return ROW_HEIGHT;
  };

  // ⭐️ 关键：将所有 Row 需要的上下文数据打包传递
  // 这样 Row 组件即使在外部定义，也能访问到内部的 state 和 hooks
  const itemData = useMemo(() => ({
    flatRows,
    toggleFile: handleToggleFile,
    theme,
    showSnackbar,
    t,
  }), [flatRows, handleToggleFile, theme, showSnackbar, t]);

  return (
    <Box sx={{ flex: 1, height: '100%' }}>
      <style>{marqueeStyles}</style>
      <AutoSizer>
        {({ height, width }) => (
          <List
            ref={listRef}
            height={height}
            width={width}
            itemCount={flatRows.length}
            itemSize={getItemSize}
            itemData={itemData}  // 传入数据包
            overscanCount={20}   // 多渲染一点防止白屏
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </Box>
  );
}));

export default VirtualizedResults;
