import React, { useMemo, useRef, useState } from 'react';
import {
  alpha,
  Box,
  IconButton,
  Input,
  Paper,
  Popover,
  useTheme,
} from '@mui/material';
import {
  KeyboardReturn,
  Replay,
  Settings,
} from '@mui/icons-material';
import { DEFAULT_SUPPORTED_EXTENSIONS, normalizeSupportedExtension } from '../config/supportedFiles';
import { useSupportedExtensions } from '../contexts/SupportedExtensionsContext';

const SupportedExtensionsEditor = () => {
  const theme = useTheme();
  const inputRef = useRef(null);
  const { extensions, extensionsWithDot, addExtension, removeExtension, setExtensions } = useSupportedExtensions();

  const [anchorEl, setAnchorEl] = useState(null);
  const [draft, setDraft] = useState('');

  const normalizedDraft = useMemo(() => normalizeSupportedExtension(draft), [draft]);
  const canAdd = !!normalizedDraft && !extensions.includes(normalizedDraft);
  const canRemoveAny = extensions.length > 1;
  const canReset = useMemo(() => (
    extensions.length !== DEFAULT_SUPPORTED_EXTENSIONS.length ||
    extensions.some((ext, index) => ext !== DEFAULT_SUPPORTED_EXTENSIONS[index])
  ), [extensions]);
  const open = Boolean(anchorEl);

  const handleAdd = () => {
    if (!canAdd) return;
    if (addExtension(normalizedDraft)) {
      setDraft('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <>
      <Box component="span" sx={{ verticalAlign: 'baseline' }}>
        <IconButton
          size="small"
          aria-label="Edit supported extensions"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            ml: 0.2,
            p: 0.2,
            borderRadius: '999px',
            color: 'text.secondary',
            opacity: open ? 0.68 : 0.24,
            transition: 'opacity 0.18s ease, background-color 0.18s ease',
            verticalAlign: 'text-bottom',
            '&:hover': {
              opacity: 0.62,
              bgcolor: alpha(theme.palette.text.primary, 0.08),
            },
          }}
        >
          <Settings sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        TransitionProps={{ timeout: 180 }}
        PaperProps={{
          elevation: 8,
          sx: {
            mt: 1,
            width: 320,
            p: 1.5,
            borderRadius: 2,
            // bgcolor: alpha(theme.palette.background.paper, 0.985),
            // border: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
            // backdropFilter: 'blur(8px)',
          },
        }}
      >
        <Box
          onClick={() => inputRef.current?.focus()}
          sx={{
            px: 0.5,
            pt: 0.1,
            pb: 0.6,
          }}
        >
          <Input
            fullWidth
            value={draft}
            inputRef={inputRef}
            autoFocus
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            disableUnderline={false}
            aria-label="Add file extension"
            onChange={(event) => setDraft(event.target.value.replace(/^\.+/, ''))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAdd();
              }
            }}
            startAdornment={(
              <Box
                component="span"
                sx={{
                  mr: 1,
                  color: 'text.secondary',
                  fontWeight: 700,
                  userSelect: 'none',
                }}
              >
                .
              </Box>
            )}
            endAdornment={(
              <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.25 }}>
                <IconButton
                  size="small"
                  aria-label="Add supported extension"
                  onClick={handleAdd}
                  disabled={!canAdd}
                  sx={{
                    p: 0.3,
                    color: canAdd ? 'primary.main' : 'text.disabled',
                    borderRadius: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', lineHeight: 0 }}>
                    <KeyboardReturn sx={{ fontSize: 14 }} />
                  </Box>
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Reset supported extensions"
                  onClick={() => setExtensions(DEFAULT_SUPPORTED_EXTENSIONS)}
                  disabled={!canReset}
                  sx={{
                    p: 0.3,
                    color: canReset ? 'text.secondary' : 'text.disabled',
                    borderRadius: 1,
                  }}
                >
                  <Replay sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            )}
            sx={{
              fontSize: 14,
              font: 'inherit',
              '&:before': {
                borderBottomColor: alpha(theme.palette.text.primary, 0.24),
              },
              '&:hover:not(.Mui-disabled, .Mui-error):before': {
                borderBottomColor: alpha(theme.palette.text.primary, 0.42),
              },
              '&:after': {
                borderBottomWidth: '2px',
              },
              '& .MuiInput-input': {
                py: 0.35,
              },
            }}
          />
        </Box>

        <Box
          sx={{
            mt: 1.2,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.85,
            minHeight: 30,
          }}
        >
          {extensions.map((ext, index) => {
            const removable = canRemoveAny;
            return (
              <Paper
                key={ext}
                component="button"
                type="button"
                elevation={0}
                onClick={() => {
                  if (removable) {
                    removeExtension(ext);
                  }
                }}
                sx={{
                  px: 1,
                  py: 0.35,
                  border: 0,
                  borderRadius: '999px',
                  bgcolor: removable
                    ? alpha(theme.palette.text.primary, 0.045)
                    : alpha(theme.palette.text.primary, 0.03),
                  color: removable ? 'text.secondary' : 'text.disabled',
                  cursor: removable ? 'pointer' : 'default',
                  userSelect: 'none',
                  transition: 'background-color 0.16s ease, color 0.16s ease, transform 0.16s ease',
                  '& .supported-extension-label': {
                    transition: 'text-decoration-color 0.16s ease, color 0.16s ease',
                  },
                  ...(removable && {
                    '&:hover': {
                      bgcolor: alpha(theme.palette.text.primary, 0.1),
                      color: 'text.primary',
                      transform: 'translateY(-1px)',
                    },
                    '&:hover .supported-extension-label': {
                      textDecoration: 'line-through',
                      textDecorationThickness: '1.5px',
                      textDecorationSkipInk: 'none',
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${alpha(theme.palette.primary.main, 0.32)}`,
                      outlineOffset: 1,
                    },
                  }),
                }}
              >
                <Box component="span" className="supported-extension-label">
                  {extensionsWithDot[index]}
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Popover>
    </>
  );
};

export default SupportedExtensionsEditor;
