import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  alpha,
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import { useLanguage } from '../utils/i18n';
import { useSnackbar } from '../contexts/SnackbarContext';

/**
 * 语言切换按钮组件
 * 显示语言下拉菜单，支持切换界面语言
 */
const LangSwitcher = () => {
  const showSnackbar = useSnackbar();
  const { lang, setLang, SUPPORTED_LANGS, t, loadedLang } = useLanguage();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [pendingLang, setPendingLang] = useState(null);

  // 当目标语言包加载完成后再显示 snackbar
  useEffect(() => {
    if (pendingLang && loadedLang === pendingLang) {
      const label = SUPPORTED_LANGS.find(l => l.id === pendingLang)?.label ?? pendingLang;
      showSnackbar(t('lang.switched', { name: label }), 'info');
      setPendingLang(null);
    }
  }, [loadedLang, pendingLang, showSnackbar, t, SUPPORTED_LANGS]);

  const handleToggle = (e) => setAnchorEl(prev => prev ? null : e.currentTarget);
  const handleClose = () => {
    if (document.activeElement) {
      document.activeElement.blur();
    }
    setAnchorEl(null);
  };

  const handleSelect = (newLang) => {
    // 先移除焦点，再关闭菜单（避免 aria-hidden 警告）
    if (document.activeElement) {
      document.activeElement.blur();
    }
    handleClose();
    if (newLang === lang) return;
    setPendingLang(newLang);
    setLang(newLang);
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleToggle}
        sx={{
          bgcolor: 'background.paper',
          boxShadow: 2,
          '&:hover': {
            boxShadow: 4,
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.8),
          },
        }}
      >
        <LanguageIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ zIndex: 1301 }}
        slotProps={{
          paper: {
            elevation: 4,
            sx: { mt: 0.5, minWidth: 130 },
          },
        }}
      >
        {SUPPORTED_LANGS.map(({ id, label }) => (
          <MenuItem
            key={id}
            value={id}
            selected={id === lang}
            onClick={() => handleSelect(id)}
            sx={{ fontSize: '0.875rem' }}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LangSwitcher;
