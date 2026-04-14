import { useState, useRef, useEffect, useCallback } from 'react';
import { tauriAPI } from '../utils/tauriBridge';

/**
 * Feedback submission hook
 * Responsibilities: prepare payload, send request, manage submitting/success/error states
 * Does NOT handle identity normalization - caller should pass normalized contributor
 * @param {Object} options
 * @param {function} options.showSnackbar - Snackbar display function
 * @returns {{ isSubmitting: boolean, showSuccess: boolean, handleSubmit: function }}
 */
export function useFeedbackSubmit({ showSnackbar }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimeoutRef = useRef(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Submit feedback
   * @param {Object} params
   * @param {string} params.contributor - Normalized contributor nickname
   * @param {Object} params.feedback - Feedback data (type, data)
   * @returns {Promise<boolean>} Success status
   */
  const handleSubmit = useCallback(
    async ({ contributor, feedback }) => {
      setIsSubmitting(true);
      try {
        await tauriAPI.submitFeedback({
          ...feedback,
          contributor,
          timestamp: new Date().toISOString(),
        });

        // Clear any existing timeout before setting new one
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        setShowSuccess(true);
        successTimeoutRef.current = window.setTimeout(() => {
          setShowSuccess(false);
          successTimeoutRef.current = null;
        }, 2500);

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        showSnackbar?.(errorMessage || 'Failed to submit feedback.', 'error');
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [showSnackbar]
  );

  return { isSubmitting, showSuccess, handleSubmit };
}
