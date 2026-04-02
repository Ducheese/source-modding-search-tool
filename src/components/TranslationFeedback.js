/**
 * TranslationFeedback.js
 * General Feedback Panel Component (Production-Ready)
 * * Supported feedback types:
 * - Translation feedback
 * - Bug report
 * - Feature request
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  Typography,
  Paper,
  CircularProgress,
  InputAdornment,
  Autocomplete,
  Fade,
  alpha,
  createFilterOptions,
  useTheme,
  Divider,
  Button,
} from '@mui/material';
import {
  Send,
  Translate,
  BugReport,
  Lightbulb,
  CheckCircle,
  ArrowDownward,
} from '@mui/icons-material';
import { SUPPORTED_LANGS } from '../utils/i18n';
import { tauriAPI } from '../utils/tauriBridge';
import { useSnackbar } from '../App';
import { useTranslationKeys } from '../utils/useTranslationKeys';
import GenericFeedbackForm from './GenericFeedbackForm';

// ─────────────────────────────────────────────────────────────
// Feedback Types Configuration
// ─────────────────────────────────────────────────────────────
const FEEDBACK_TYPES = [
  {
    id: 'translation',
    label: 'Translation',
    icon: Translate,
    description: 'Help us improve translation quality.',
  },
  {
    id: 'bug',
    label: 'Bug Report',
    icon: BugReport,
    description: 'Report an issue you encountered.',
  },
  {
    id: 'feature',
    label: 'Feature Request',
    icon: Lightbulb,
    description: 'Suggest a new feature.',
  },
];

const MAX_LEN = {
  title: 200,
  description: 4000,
  steps: 2000,
  suggestion: 4000,
};

// ─────────────────────────────────────────────────────────────
// Translation Feedback Form
// ─────────────────────────────────────────────────────────────
const TranslationFeedbackForm = ({ onSubmit, isSubmitting }) => {
  const [selectedLang, setSelectedLang] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [suggestion, setSuggestion] = useState('');

  const { translationMap, keyOptions, isLoading, error } = useTranslationKeys(selectedLang);
  const filterOptions = createFilterOptions({ stringify: (opt) => `${opt.key} ${opt.value}` });
  const currentTranslation = selectedKey ? translationMap.get(selectedKey) ?? '' : '';

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!selectedLang || !selectedKey || !suggestion.trim() || isSubmitting) return;
      const ok = await onSubmit({
        type: 'translation',
        data: {
          language: selectedLang,
          key: selectedKey,
          currentTranslation,
          suggestedTranslation: suggestion.trim(),
        },
      });
      if (ok) {
        setSelectedKey(null);
        setSuggestion('');
      }
    },
    [selectedLang, selectedKey, suggestion, currentTranslation, onSubmit, isSubmitting]
  );

  const isValid = !!(selectedLang && selectedKey && suggestion.trim() && suggestion.length <= MAX_LEN.suggestion);

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          select
          label="Select Language"
          value={selectedLang}
          onChange={(e) => {
            setSelectedLang(e.target.value);
            setSelectedKey(null);
            setSuggestion('');
          }}
          fullWidth
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Translate fontSize="small" />
              </InputAdornment>
            ),
          }}
        >
          {SUPPORTED_LANGS.map((lang) => (
            <MenuItem key={lang.id} value={lang.id}>
              {lang.label}
            </MenuItem>
          ))}
        </TextField>

        {selectedLang && (
          <Autocomplete
            fullWidth
            options={keyOptions}
            value={keyOptions.find((opt) => opt.key === selectedKey) ?? null}
            onChange={(_, val) => {
              setSelectedKey(val?.key ?? null);
              setSuggestion('');
            }}
            loading={isLoading}
            disabled={isLoading || keyOptions.length === 0}
            filterOptions={filterOptions}
            getOptionLabel={(opt) => opt.key}
            isOptionEqualToValue={(opt, val) => opt.key === val.key}
            renderOption={(props, opt) => (
              <li {...props} key={opt.key}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body2" fontWeight={500}>
                    {opt.key}
                  </Typography>
                  {opt.value && (
                    <Typography variant="caption" color="text.secondary">
                      {opt.value.slice(0, 60)}
                      {opt.value.length > 60 ? '…' : ''}
                    </Typography>
                  )}
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Translation Key"
                size="small"
                error={!!error}
                helperText={error ? 'Failed to load translation keys. Please try again.' : undefined}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isLoading && <CircularProgress size={16} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        )}
      </Box>

      {/* 视觉对比组：原文 -> 建议 */}
      {selectedKey && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              display="block"
              sx={{ mb: 1 }}
            >
              Current Translation
            </Typography>
            <Box
              sx={{
                p: 1.5,
                bgcolor: 'action.hover',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2">
                {currentTranslation || <em>(Empty)</em>}
              </Typography>
            </Box>
          </Box>

          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              display="block"
              sx={{ mb: 1 }}
            >
              Suggested Translation
            </Typography>
            <TextField
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              multiline
              minRows={3}
              maxRows={6}
              fullWidth
              error={suggestion.length > MAX_LEN.suggestion}
              helperText={`${suggestion.length}/${MAX_LEN.suggestion}`}
              placeholder="Enter a more natural or accurate translation..."
              disabled={isSubmitting}
              size="small"
            />
          </Box>
        </Box>
      )}

      {selectedKey && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            disabled={!isValid || isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : <Send />}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
const TranslationFeedback = () => {
  const theme = useTheme();
  const showSnackbar = useSnackbar();
  const [feedbackType, setFeedbackType] = useState('translation');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Ref for timeout cleanup
  const successTimeoutRef = useRef(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmitFeedback = useCallback(
    async (feedback) => {
      setIsSubmitting(true);
      try {
        await tauriAPI.submitFeedback({
          ...feedback,
          timestamp: new Date().toISOString(),
        });
        setShowSuccess(true);

        // Store timeout ref for cleanup
        successTimeoutRef.current = setTimeout(() => {
          setShowSuccess(false);
        }, 2500);

        return true;
      } catch (error) {
        // Improved error handling: preserve Error message
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        showSnackbar(errorMessage || 'Failed to submit feedback.', 'error');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [showSnackbar]
  );

  const renderFeedbackContent = () => {
    const props = { onSubmit: handleSubmitFeedback, isSubmitting };

    switch (feedbackType) {
      case 'translation':
        return <TranslationFeedbackForm {...props} />;

      case 'bug':
        return (
          <GenericFeedbackForm
            {...props}
            submitLabel="Submit"
            submitLoadingLabel="Submitting..."
            fields={{
              title: {
                name: 'title',
                label: 'Bug Title',
                placeholder: 'Brief description of the issue',
                multiline: false,
                maxLength: MAX_LEN.title,
                required: true,
              },
              description: {
                name: 'description',
                label: 'Description',
                placeholder: 'What happened? What did you expect?',
                multiline: true,
                minRows: 3,
                maxRows: 6,
                maxLength: MAX_LEN.description,
                required: true,
              },
              steps: {
                name: 'steps',
                label: 'Steps to Reproduce (Optional)',
                placeholder: '1. Open app\n2. Click on...\n3. See error',
                multiline: true,
                minRows: 3,
                maxRows: 6,
                maxLength: MAX_LEN.steps,
                required: false,
              },
            }}
          />
        );

      case 'feature':
        return (
          <GenericFeedbackForm
            {...props}
            submitLabel="Submit"
            submitLoadingLabel="Submitting..."
            fields={{
              title: {
                name: 'title',
                label: 'Feature Title',
                placeholder: 'Brief description of the feature',
                multiline: false,
                maxLength: MAX_LEN.title,
                required: true,
              },
              description: {
                name: 'description',
                label: 'Description',
                placeholder: 'Why would it be useful?',
                multiline: true,
                minRows: 3,
                maxRows: 6,
                maxLength: MAX_LEN.description,
                required: true,
              },
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ position: 'relative', minHeight: 400 }}>
      {/* 原地替换的成功视图，不遮挡，直接占据空间 */}
      <Fade in={showSuccess} timeout={400} unmountOnExit>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            bgcolor: 'background.default',
          }}
        >
          <CheckCircle
            sx={{
              fontSize: 64,
              color: 'success.main',
              animation:
                'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
          />
          <Typography variant="h6" fontWeight={600} color="text.primary">
            Feedback Submitted
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Thank you for helping us improve.
          </Typography>
          <style>{`@keyframes scaleIn { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
        </Box>
      </Fade>

      {/* 主表单区域：成功时淡出 */}
      <Fade in={!showSuccess} timeout={400}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 交互式卡片导航 */}
          <Box sx={{ display: 'flex', gap: 2 }} role="radiogroup" aria-label="Feedback Type Selection">
            {FEEDBACK_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = feedbackType === type.id;
              return (
                <Paper
                  key={type.id}
                  component="button"
                  onClick={() => !isSubmitting && setFeedbackType(type.id)}
                  elevation={0}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSubmitting ? -1 : 0}
                  sx={{
                    flex: 1,
                    p: 2,
                    textAlign: 'left',
                    border: '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    backgroundColor: isSelected
                      ? alpha(theme.palette.primary.main, 0.04)
                      : 'background.paper',
                    cursor: isSubmitting ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                    borderRadius: 2,
                    opacity: isSubmitting && !isSelected ? 0.6 : 1,
                    '&:hover': {
                      borderColor: isSubmitting ? undefined : 'primary.main',
                      boxShadow: isSubmitting
                        ? 'none'
                        : '0 4px 12px rgba(0,0,0,0.05)',
                    },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Icon
                    sx={{
                      color: isSelected ? 'primary.main' : 'text.secondary',
                      mb: 1,
                      fontSize: 28,
                    }}
                  />
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: isSelected ? 'primary.main' : 'text.primary',
                    }}
                  >
                    {type.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5, lineHeight: 1.2 }}
                  >
                    {type.description}
                  </Typography>
                </Paper>
              );
            })}
          </Box>

          <Divider />

          {/* 表单内容 */}
          <Box>{renderFeedbackContent()}</Box>
        </Box>
      </Fade>
    </Box>
  );
};

export default TranslationFeedback;
