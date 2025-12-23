import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ExpandMore,
  ContentCopy,
  Launch,
} from '@mui/icons-material';

// 虚拟化列表组件
const VirtualizedResults = ({ results }) => {
  const theme = useTheme();
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [expandedPanels, setExpandedPanels] = useState(new Set());

  // 每个结果项的预估高度
  const ITEM_HEIGHT = 120; // 预估每个匹配项的高度
  const HEADER_HEIGHT = 80; // 文件头的高度

  // 计算可视区域内的项目
  const visibleItems = useMemo(() => {
    if (!results || !results.files) return [];

    const items = [];
    let currentOffset = 0;

    results.files.forEach((file) => {
      // 文件头
      const fileHeaderItem = {
        type: 'header',
        file,
        offset: currentOffset,
        height: HEADER_HEIGHT,
      };
      items.push(fileHeaderItem);
      currentOffset += HEADER_HEIGHT;

      // 文件匹配项
      if (expandedPanels.has(file.path)) {
        file.matches.forEach((match) => {
          const matchItem = {
            type: 'match',
            file,
            match,
            offset: currentOffset,
            height: ITEM_HEIGHT,
          };
          items.push(matchItem);
          currentOffset += ITEM_HEIGHT;
        });
      }
    });

    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 2);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + 2
    );

    return {
      items: items.slice(startIndex, endIndex + 1),
      totalHeight: currentOffset,
      startIndex,
      endIndex,
    };
  }, [results, expandedPanels, scrollTop, containerHeight]);

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  const handlePanelChange = (panelPath) => (event, isExpanded) => {
    setExpandedPanels(prev => {
      const newSet = new Set(prev);
      if (isExpanded) {
        newSet.add(panelPath);
      } else {
        newSet.delete(panelPath);
      }
      return newSet;
    });
  };

  const copyFilePath = (path) => {
    navigator.clipboard.writeText(path);
  };

  const copyFileContent = async (path) => {
    try {
      const { content } = await window.electronAPI.readFile(path);
      navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy file content:', error);
    }
  };
  
  const copyLineContent = (line) => {
    // 剔除换行符和其他空白字符
    const cleanLine = line.replace(/[\r\n]+/g, '').trim();
    navigator.clipboard.writeText(cleanLine);
  };

  const openFileExternally = (path) => {
    window.electronAPI.openFileExternally(path);
  };

  const highlightMatch = (text, query, options) => {
    if (!query) return text;

    try {
      let searchRegex;
      if (options.useRegex) {
        searchRegex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
      } else {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = options.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
        searchRegex = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
      }

      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = searchRegex.exec(text)) !== null) {
        parts.push(text.slice(lastIndex, match.index));
        parts.push(
          <span
            key={match.index}
            style={{
              backgroundColor: alpha(theme.palette.primary.main, 0.3),
              color: theme.palette.primary.dark,
              fontWeight: 'bold',
              padding: '2px 4px',
              borderRadius: '3px',
            }}
          >
            {match[0]}
          </span>
        );
        lastIndex = searchRegex.lastIndex;
      }

      parts.push(text.slice(lastIndex));
      return parts;
    } catch (error) {
      return text;
    }
  };

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  if (!results || !results.files || results.files.length === 0) {
    return null;
  }

  const { items, totalHeight, startIndex } = visibleItems;

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        overflow: 'auto',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      {/* 虚拟化容器 */}
      <Box sx={{ height: totalHeight, position: 'relative' }}>
        {items.map((item, index) => {
          const globalIndex = startIndex + index;
          
          if (item.type === 'header') {
            return (
              <Box
                key={`header-${item.file.path}`}
                sx={{
                  position: 'absolute',
                  top: item.offset,
                  left: 0,
                  right: 0,
                  height: item.height,
                  bgcolor: 'background.paper',
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Accordion
                  expanded={expandedPanels.has(item.file.path)}
                  onChange={handlePanelChange(item.file.path)}
                  disableGutters // [修复1] 禁用展开时的外边距
                  sx={{ boxShadow: 'none', height: '100%' }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMore />}
                    sx={{
                      minHeight: HEADER_HEIGHT, // [修复2] 设定固定最小高度
                      padding: '0 16px',       // 显式设定 padding
                      '&.Mui-expanded': {
                        minHeight: HEADER_HEIGHT, // [修复3] 展开时保持高度不变
                      },
                      '& .MuiAccordionSummary-content': {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        // height: HEADER_HEIGHT - 16, // 减去padding
                        height: '100%', // 让内容填满高度
                        margin: 0, // [修复4] 移除默认 margin
                        '&.Mui-expanded': {
                          margin: 0, // [修复5] 展开时也不要增加 margin
                        },
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {item.file.name}
                      </Typography>
                      <Chip size="small" label={`${item.file.matches.length} 匹配`} color="primary" />
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        // ⭐️ 传入 event 对象并调用 e.stopPropagation()
                        onClick={(e) => {
                          e.stopPropagation(); // 阻止事件冒泡到 AccordionSummary
                          copyFilePath(item.file.path);
                        }}
                        title="复制路径"
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>

                      <IconButton
                        size="small"
                        // ⭐️ 传入 event 对象并调用 e.stopPropagation()
                        onClick={(e) => {
                          e.stopPropagation(); // 阻止事件冒泡到 AccordionSummary
                          copyFileContent(item.file.path);
                        }}
                        title="复制文件内容"
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>

                      <IconButton
                        size="small"
                        // ⭐️ 传入 event 对象并调用 e.stopPropagation()
                        onClick={(e) => {
                          e.stopPropagation(); // 阻止事件冒泡到 AccordionSummary
                          openFileExternally(item.file.path);
                        }}
                        title="用默认程序打开"
                      >
                        <Launch fontSize="small" />
                      </IconButton>
                    </Box>

                  </AccordionSummary>
                </Accordion>
              </Box>
            );
          }

          if (item.type === 'match') {
            return (
              <Box
                key={`match-${item.file.path}-${item.match.lineNumber}`}
                sx={{
                  position: 'absolute',
                  top: item.offset,
                  left: 0,
                  right: 0,
                  height: item.height,
                  bgcolor: 'background.paper',
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
                  p: 2,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="primary" fontWeight="bold">
                    行 {item.match.lineNumber}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => copyLineContent(item.match.line)}
                    title="复制这一行"
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Box>

                <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {item.match.context.before && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ opacity: 0.7 }}
                    >
                      {item.match.lineNumber - 1}: {item.match.context.before}
                    </Typography>
                  )}
                  <Typography variant="body2">
                    {item.match.lineNumber}: {highlightMatch(item.match.line, results.query, results.options)}
                  </Typography>
                  {item.match.context.after && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ opacity: 0.7 }}
                    >
                      {item.match.lineNumber + 1}: {item.match.context.after}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          }

          return null;
        })}
      </Box>
    </Box>
  );
};

export default VirtualizedResults;