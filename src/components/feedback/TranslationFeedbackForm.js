import React, { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  Button,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import { Send } from '@mui/icons-material';
import { SUPPORTED_LANGS } from '../../config/languages';
import { useTranslationKeys } from '../../hooks/useTranslationKeys';
import { MAX_LEN } from '../../config/feedbackConfig';
import TranslationKeyAutocomplete from './TranslationKeyAutocomplete';

/**
 * Translation feedback form component
 * @param {Object} props
 * @param {function} props.onSubmit - Submit callback, receives { type, data }
 * @param {boolean} props.isSubmitting - Submission in progress
 */
const TranslationFeedbackForm = ({ onSubmit, isSubmitting }) => {
  const [selectedLang, setSelectedLang] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [suggestion, setSuggestion] = useState('');
  const [suggestionTouched, setSuggestionTouched] = useState(false);

  const { translationMap, keyOptions, isLoading, error } = useTranslationKeys(selectedLang);
  const currentTranslation = selectedKey ? translationMap.get(selectedKey) ?? '' : '';

  // ─────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────
  const trimmedSuggestion = suggestion.trim();
  const isSameAsCurrent = !!trimmedSuggestion && trimmedSuggestion === currentTranslation.trim();
  const suggestionError = suggestionTouched && !trimmedSuggestion;
  const isValid = !!(
    selectedLang &&
    selectedKey &&
    trimmedSuggestion &&
    suggestion.length <= MAX_LEN.suggestion &&
    !isSameAsCurrent
  );

  // ─────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────
  const handleLanguageChange = useCallback((lang) => {
    setSelectedLang(lang?.id ?? '');
    setSelectedKey(null);
    setSuggestion('');
    setSuggestionTouched(false);
  }, []);

  const handleKeyChange = useCallback((key) => {
    setSelectedKey(key);
    setSuggestion('');
    setSuggestionTouched(false);
  }, []);

  const handleSuggestionChange = useCallback((value) => {
    setSuggestion(value);
  }, []);

  const handleSuggestionBlur = useCallback(() => {
    setSuggestionTouched(true);
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      // Mark suggestion as touched when attempting to submit
      setSuggestionTouched(true);
      if (!selectedLang || !selectedKey || !trimmedSuggestion || isSubmitting || isSameAsCurrent) return;
      const ok = await onSubmit({
        type: 'translation',
        data: {
          language: selectedLang,
          key: selectedKey,
          currentTranslation,
          suggestedTranslation: trimmedSuggestion,
        },
      });
      if (ok) {
        setSelectedKey(null);
        setSuggestion('');
        setSuggestionTouched(false);
      }
    },
    [selectedLang, selectedKey, trimmedSuggestion, currentTranslation, onSubmit, isSubmitting, isSameAsCurrent]
  );

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Autocomplete
          options={SUPPORTED_LANGS}
          value={SUPPORTED_LANGS.find((lang) => lang.id === selectedLang) ?? null}
          onChange={(_, val) => handleLanguageChange(val)}
          getOptionLabel={(opt) => opt.label}
          isOptionEqualToValue={(opt, val) => opt.id === val.id}
          sx={{ flex: 1, minWidth: 240 }}
          size="small"
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Language"
            />
          )}
        />

        {selectedLang && (
          <TranslationKeyAutocomplete
            keyOptions={keyOptions}
            selectedKey={selectedKey}
            onChange={handleKeyChange}
            isLoading={isLoading}
            error={error}
          />
        )}
      </Box>

      {/* Visual comparison group: original -> suggestion */}
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
              onChange={(e) => handleSuggestionChange(e.target.value)}
              onBlur={handleSuggestionBlur}
              multiline
              minRows={3}
              maxRows={6}
              fullWidth
              error={suggestionError || suggestion.length > MAX_LEN.suggestion || isSameAsCurrent}
              helperText={
                suggestionError
                  ? 'This field is required'
                  : isSameAsCurrent
                    ? 'Suggested translation must be different from current translation'
                    : `${suggestion.length}/${MAX_LEN.suggestion}`
              }
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

export default TranslationFeedbackForm;
