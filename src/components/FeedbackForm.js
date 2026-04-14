/**
 * FeedbackForm.js
 * Orchestrator component for feedback submission
 * Coordinates identity state, submission logic, and form rendering
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Fade,
  alpha,
  useTheme,
  Divider,
} from '@mui/material';
import {
  Translate,
  BugReport,
  Lightbulb,
  CheckCircle,
} from '@mui/icons-material';
import { useSnackbar } from '../App';
import { FEEDBACK_TYPES, BUG_FIELDS, FEATURE_FIELDS } from '../config/feedbackConfig';
import { useFeedbackIdentity } from '../hooks/useFeedbackIdentity';
import { useFeedbackSubmit } from '../hooks/useFeedbackSubmit';
import TranslationFeedbackForm from './feedback/TranslationFeedbackForm';
import ContributorIdentityField from './feedback/ContributorIdentityField';
import SimpleFeedbackForm from './SimpleFeedbackForm';

// ─────────────────────────────────────────────────────────────
// Icon mapping for feedback types
// ─────────────────────────────────────────────────────────────
const ICON_MAP = {
  Translate,
  BugReport,
  Lightbulb,
};

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
const FeedbackForm = () => {
  const theme = useTheme();
  const showSnackbar = useSnackbar();
  const [feedbackType, setFeedbackType] = useState('translation');

  // Identity state management
  const {
    anonymousId,
    contributorNickname,
    effectiveNickname,
    hasCustomNickname,
    onChange: handleNicknameChange,
    onBlur: handleNicknameBlur,
    onReset: handleNicknameReset,
    setIdentity,
  } = useFeedbackIdentity();

  // Submission logic
  const { isSubmitting, showSuccess, handleSubmit } = useFeedbackSubmit({ showSnackbar });

  // Wrap submit to handle normalization before calling handleSubmit
  const wrappedSubmit = useCallback(
    async (feedback) => {
      const normalized = effectiveNickname;
      // Sync normalized nickname back to identity state if changed
      if (normalized !== contributorNickname) {
        setIdentity((prev) => ({
          ...prev,
          contributorNickname: normalized,
        }));
      }
      return handleSubmit({ contributor: normalized, feedback });
    },
    [effectiveNickname, contributorNickname, setIdentity, handleSubmit]
  );

  // Render feedback content based on type
  const renderFeedbackContent = useCallback(() => {
    const commonProps = { isSubmitting };

    switch (feedbackType) {
      case 'translation':
        return <TranslationFeedbackForm onSubmit={wrappedSubmit} {...commonProps} />;

      case 'bug':
        return (
          <SimpleFeedbackForm
            {...commonProps}
            onSubmit={(formData) => wrappedSubmit({ type: 'bug', data: formData })}
            submitLabel="Submit"
            submitLoadingLabel="Submitting..."
            fields={BUG_FIELDS}
          />
        );

      case 'feature':
        return (
          <SimpleFeedbackForm
            {...commonProps}
            onSubmit={(formData) => wrappedSubmit({ type: 'feature', data: formData })}
            submitLabel="Submit"
            submitLoadingLabel="Submitting..."
            fields={FEATURE_FIELDS}
          />
        );

      default:
        return null;
    }
  }, [feedbackType, isSubmitting, wrappedSubmit]);

  return (
    <Box sx={{ position: 'relative', minHeight: 400 }}>
      {/* Success overlay */}
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
          }}
        >
          <CheckCircle
            sx={{
              fontSize: 64,
              color: 'success.main',
              '@keyframes scaleIn': {
                '0%': { transform: 'scale(0.5)', opacity: 0 },
                '100%': { transform: 'scale(1)', opacity: 1 },
              },
              animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
          />
          <Typography variant="h6" fontWeight={600} color="text.primary">
            Feedback Submitted
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Thank you for helping us improve.
          </Typography>
        </Box>
      </Fade>

      {/* Main form area */}
      <Fade in={!showSuccess} timeout={400}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <ContributorIdentityField
            anonymousId={anonymousId}
            contributorNickname={contributorNickname}
            hasCustomContributorNickname={hasCustomNickname}
            onChange={handleNicknameChange}
            onBlur={handleNicknameBlur}
            onReset={handleNicknameReset}
            isSubmitting={isSubmitting}
          />

          {/* Interactive card navigation */}
          <Box sx={{ display: 'flex', gap: 2 }} role="radiogroup" aria-label="Feedback Type Selection">
            {FEEDBACK_TYPES.map((type) => {
              const Icon = ICON_MAP[type.icon] || type.icon;
              const isSelected = feedbackType === type.id;
              return (
                <Paper
                  key={type.id}
                  component="button"
                  type="button"
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

          <Divider>
            <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
              Powered by Formspree
            </Typography>
          </Divider>

          {/* Form content */}
          <Box>{renderFeedbackContent()}</Box>
        </Box>
      </Fade>
    </Box>
  );
};

export default FeedbackForm;