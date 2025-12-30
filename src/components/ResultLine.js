import React, { memo } from 'react';
import { Box, Typography, IconButton, alpha, useTheme } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';

// 原子组件：渲染一行代码（包含行号、内容、复制行按钮）
const ResultLine = memo(({
  lineNumber,
  content,           // 可以是 String (上下文) 或 Segment数组 (匹配行)
  isMatch = false,   // 是否是匹配行（高亮行）
  onCopy,
}) => {
  const theme = useTheme();

  // 严格控制高度
  const ROW_HEIGHT = 32;

  const isEmpty = !content || (Array.isArray(content) && content.length === 0) || content === '';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: ROW_HEIGHT,   // 强制固定高度，防止被横向滚动条撑开
        width: '100%',
        boxSizing: 'border-box',   // 内边距和边框不再增加元素的总尺寸。 它们会被“挤入”你设定的 width 和 height 内部。
        bgcolor: isMatch ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
        '&:hover .action-btn': { opacity: 1 },   // 鼠标悬停整行时显示按钮
      }}
    >
      {/* 1. 行号区域 (固定宽度) */}
      <Box
        sx={{
          width: 60,
          minWidth: 60,   // 消除弹性布局 (Flex/Grid) 的影响，防止被压缩至50以下
          textAlign: 'right',   // 内容靠右对齐
          pr: 1,   // padding-right (右内边距)
          color: isMatch ? theme.palette.primary.main : alpha(theme.palette.text.secondary, 0.3),
          userSelect: 'none',   // 无法选中复制行号
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          // opacity: 0.8,   // 微微淡化
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          height: '100%',
          display: 'flex',   // Flex容器
          alignItems: 'center',   // 默认是flex-direction: row，主轴是水平方向，交叉轴就是垂直的，所以这里的center是垂直居中
          justifyContent: 'flex-end',   // 默认是flex-direction: row，主轴是水平方向，flex-end就是指靠右对齐
        }}
      >
        <Typography
          variant="body2"
        >
          {lineNumber}
        </Typography>
      </Box>

      {/* 2. 文本内容区域 (自适应宽度，内部横向滚动) */}
      <Box
        sx={{
          flex: 1,
          height: '100%',
          overflowX: 'auto',    // 开启横向滚动
          overflowY: 'hidden',  // 禁止纵向滚动
          whiteSpace: 'pre',    // 禁止换行
          display: 'flex',
          alignItems: 'center',
          px: 1,   // 水平方向上的内边距（Padding on the X-axis）
          fontFamily: 'monospace',   // 等宽字体是必须的
          fontSize: '0.875rem',
          color: isMatch ? theme.palette.text.primary : alpha(theme.palette.text.secondary, 0.3),
          // 美化滚动条
          '&::-webkit-scrollbar': {
            height: '3px',   // 很细的滚动条
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(theme.palette.text.primary, 0.1),   // 以此为标准？
            borderRadius: '2px',   // 圆角
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
        }}
      >
        {Array.isArray(content) ? (
          // 渲染后端切好的片段
          content.map((seg, i) => (
            <span
              key={i}
              style={{
                backgroundColor: seg.is_match ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
                color: seg.is_match ? theme.palette.primary.main : theme.palette.text.primary,
                fontWeight: seg.is_match ? 'bold' : 'normal',
                borderRadius: '2px',
              }}
            >
              <Typography
                variant="body2"
              >
                {seg.text}
              </Typography>
            </span>
          ))
        ) : (
          // 普通字符串（上下文）
          <span>
            <Typography
              variant="body2"
            >
              {content}
            </Typography>
          </span>
        )}
      </Box>

      {/* 3. 操作按钮区域 (固定在右侧) */}
      <Box
        sx={{
          width: 40,
          minWidth: 40,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderLeft: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          height: '100%',
        }}
      >
        {!isEmpty ? (
          <IconButton
            className="action-btn"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            sx={{
              opacity: 0,   // 默认隐藏
              transition: 'opacity 0.2s',
              padding: 0.5,
              color: 'text.secondary',
            }}
            title="复制此行"
          >
            <ContentCopy sx={{ fontSize: 16 }} />
          </IconButton>
        ) : (
          null
        )}
      </Box>
    </Box>
  );
});

export default ResultLine;