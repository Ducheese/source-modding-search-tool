import React, { useRef, useState, useMemo, useEffect, memo } from 'react';
import { Box, Typography, IconButton, Chip, useTheme, alpha } from '@mui/material';
import { ExpandMore, ExpandLess, CopyAll, FileOpen } from '@mui/icons-material';
import { VariableSizeList as List, areEqual } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useSnackbar } from '../App';
import { tauriAPI } from '../utils/tauriBridge';
import ResultLine from './ResultLine';   // 引入原子组件

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
  // 计算全局同步延迟：当前时间(秒) % 周期(10秒)
  // 取负值，让动画直接跳到对应进度
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
      title="复制路径"
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
  const { flatRows, toggleFile, theme, showSnackbar } = data;
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
      showSnackbar('文件路径已复制', 'success');
    };

    const handleCopyContent = async () => {
      try {
        const { content } = await tauriAPI.readFile(file.path);
        navigator.clipboard.writeText(content);
        showSnackbar('文件内容已复制', 'success');
      } catch (error) {
        console.error('Failed to copy file content:', error);
        showSnackbar('文件内容复制失败', 'error');
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
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleFile(file.path); }} sx={{ mr: 1 }}>
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden', mr: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            {file.name}
          </Typography>
          {/* 使用提取出的跑马灯组件 */}
          <FileMarquee path={file.path} onCopy={handleCopyPath} />
        </Box>

        <Chip size="small" label={`${file.matches.length}`} color="primary" sx={{ height: 20, mr: 2, userSelect: 'none' }} />

        {/* 工具栏 */}
        <IconButton size="small" title="复制完整内容" onClick={handleCopyContent}>
          <CopyAll fontSize="small" />
        </IconButton>
        <IconButton size="small" title="用默认应用打开" onClick={() => tauriAPI.openFileExternally(file.path)}>
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
          showSnackbar('行内容已复制', 'success');
        }}
      />
    </div>
  );
}, areEqual); // 使用 react-window 的 areEqual 进行性能优化


// --- 主组件 ---
const VirtualizedResults = ({ results }) => {
  const theme = useTheme();
  const showSnackbar = useSnackbar();
  const listRef = useRef(null);

  // 常量定义
  const HEADER_HEIGHT = 48;   // 文件头的高度，稍微调小一点，更精致
  const ROW_HEIGHT = 32;   // 和 ResultLine 里的保持一致
  const SEPARATOR_HEIGHT = 16;   // 分隔区域的高度

  // 折叠展开状态
  const [expandedFiles, setExpandedFiles] = useState(new Set());

  // --- 关键修复：当数据变化时，强制重置列表缓存 ---
  // 没有这段就会出现 "渲染错位"
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [results, expandedFiles]);   // 监听 expandedFiles 变化也很重要

  // 初始化时默认展开所有文件（或者你可以改成默认折叠）
  useEffect(() => {
    if (results && results.files) {
      // const allPaths = new Set(results.files.map(f => f.path));
      // setExpandedFiles(allPaths);
      setExpandedFiles(new Set());   // 默认折叠
    }
  }, [results]);

  const toggleFile = (path) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

    // 这里重复写，是为了能更快的响应
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  };

  // --- 数据展平 (Flattening) ---
  // 将层级结构 (Files -> Matches) 展平成一维数组 (Rows) 以供 React-window 使用
  const flatRows = useMemo(() => {
    const rows = [];
    if (!results || !results.files) return rows;

    results.files.forEach((file, index) => {

      // 2. 文件头
      rows.push({
        type: 'header', file, isExpanded: expandedFiles.has(file.path),
        isLast: index === results.files.length - 1,
        isFirst: index === 0
      });

      // 3. 匹配内容
      if (expandedFiles.has(file.path)) {
        file.matches.forEach(match => {
          // 上下文 (Before)
          if (match.context.before !== null) {
            rows.push({ type: 'context', content: match.context.before, lineNumber: match.line_number - 1 });
          }

          // 匹配本身 (Match)
          rows.push({ type: 'match', content: match.segments, lineNumber: match.line_number });

          // 上下文 (After)
          if (match.context.after !== null) {
            rows.push({ type: 'context', content: match.context.after, lineNumber: match.line_number + 1 });
          }

          // ⭐️ 注入分隔区域 (Separator) ，姑且是每组都加
          rows.push({ type: 'separator' });
        });
      }
    });
    return rows;
  }, [results, expandedFiles]);

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
    toggleFile,
    theme,
    showSnackbar
  }), [flatRows, theme, showSnackbar]);

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
};

export default VirtualizedResults;