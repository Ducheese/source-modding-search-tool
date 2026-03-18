import { alpha } from '@mui/material';

// ── Memo ──
// markdownStyles 依赖 theme，只在 theme 切换时重建，不随每次渲染重建
export const getMarkdownStyles = (theme) => ({
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  lineHeight: 1.75,
  color: theme.palette.text.primary,
  maxWidth: '100%',
  wordBreak: 'break-word',
  '& p': { margin: '0.5rem 0 1rem 0' },
  // 标题：每级明确区分字号（参考 Typora 默认主题比例）
  '& h1': { fontSize: '1.8em', fontWeight: 700, margin: '1.5rem 0 0.8rem', lineHeight: 1.3 },
  '& h2': { fontSize: '1.4em', fontWeight: 600, margin: '1.4rem 0 0.7rem', lineHeight: 1.3 },
  '& h3': { fontSize: '1.15em', fontWeight: 600, margin: '1.2rem 0 0.6rem', lineHeight: 1.3 },
  '& h4': { fontSize: '1em', fontWeight: 600, fontStyle: 'italic', margin: '1rem 0 0.5rem' },
  '& ul, & ol': { paddingLeft: '1.5rem', margin: '0 0 1rem 0' },
  '& li': { marginBottom: '0.35rem' },
  // 链接
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
  },
  // 图片
  '& img': { maxWidth: '100%', height: 'auto', borderRadius: '4px' },
  // 分割线
  '& hr': {
    border: 'none',
    borderTop: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
    margin: '1.5rem 0',
  },
  // 表格
  '& table': {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '1rem',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: `0 0 0 1px ${alpha(theme.palette.divider, 0.25)}`,
  },
  '& th, & td': {
    border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
    padding: '9px 14px',
    textAlign: 'left',
    fontSize: '0.9rem',
  },
  '& th': {
    backgroundColor: alpha(theme.palette.text.primary, 0.04),
    fontWeight: 600,
    whiteSpace: 'nowrap',   // ← 加这一行，标题行永不换行
  },
  // 行内代码
  '& code': {
    fontFamily: '"JetBrains Mono", Consolas, Monaco, "Courier New", monospace',
    fontSize: '0.85em',
    color: theme.palette.mode === 'dark' ? '#ff7b72' : '#d73a49',
    backgroundColor: alpha(theme.palette.text.primary, 0.06),
    padding: '0.15em 0.4em',
    borderRadius: '4px',
    fontWeight: 400,   // ← 加这一行，代码不会被加粗
  },
  // 代码块
  '& pre': {
    backgroundColor: theme.palette.mode === 'dark' ? '#161b22' : '#f6f8fa',
    padding: '14px 16px',
    borderRadius: '8px',
    overflowX: 'auto',
    margin: '0 0 1rem 0',
    '& code': { color: 'inherit', backgroundColor: 'transparent', padding: 0 },
  },
  // 引用块（挺好的，对味了）
  '& blockquote': {
    margin: '0 0 1rem 0',
    padding: '0.3rem 0 0.3rem 1rem',
    borderLeft: `3px solid ${alpha(theme.palette.text.secondary, 0.3)}`,
    // 不设 backgroundColor
    color: theme.palette.text.secondary,
    borderRadius: 0,
    fontStyle: 'italic',  // 斜体是 blockquote 的经典语义表达
    '& p': { margin: 0 },
    '& code': { fontStyle: 'normal' },  // 代码不斜体
  },
});