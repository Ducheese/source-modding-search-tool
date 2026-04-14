import { useState, useCallback, useEffect } from 'react';
import {
  loadFeedbackIdentity,
  saveFeedbackIdentity,
  sanitizeContributorNicknameDraft,
  normalizeContributorNickname,
} from '../utils/feedbackIdentity';

/**
 * Feedback identity state management hook
 * Handles initialization, auto-persistence, and input/blur/reset events
 * @returns {{
 *   anonymousId: string,
 *   contributorNickname: string,
 *   effectiveNickname: string,
 *   hasCustomNickname: boolean,
 *   onChange: function,
 *   onBlur: function,
 *   onReset: function,
 *   setIdentity: function
 * }}
 */
export function useFeedbackIdentity() {
  const [identity, setIdentity] = useState(loadFeedbackIdentity);
  const { anonymousId, contributorNickname } = identity;

  // Auto-persist to localStorage
  useEffect(() => {
    saveFeedbackIdentity(identity);
  }, [identity]);

  // Handle input change: sanitize draft
  const handleChange = useCallback((event) => {
    const nextValue = sanitizeContributorNicknameDraft(event.target.value);
    setIdentity((prev) => ({
      ...prev,
      contributorNickname: nextValue,
    }));
  }, []);

  // Handle blur: normalize value
  const handleBlur = useCallback(() => {
    setIdentity((prev) => {
      const normalized = normalizeContributorNickname(
        prev.contributorNickname,
        prev.anonymousId
      );

      return normalized === prev.contributorNickname
        ? prev
        : { ...prev, contributorNickname: normalized };
    });
  }, []);

  // Handle reset: use anonymous ID
  const handleReset = useCallback(() => {
    setIdentity((prev) =>
      prev.contributorNickname === prev.anonymousId
        ? prev
        : { ...prev, contributorNickname: prev.anonymousId }
    );
  }, []);

  // Derived state
  const effectiveNickname = normalizeContributorNickname(contributorNickname, anonymousId);
  const hasCustomNickname = effectiveNickname !== anonymousId;

  return {
    anonymousId,
    contributorNickname,
    effectiveNickname,
    hasCustomNickname,
    onChange: handleChange,
    onBlur: handleBlur,
    onReset: handleReset,
    setIdentity,
  };
}
