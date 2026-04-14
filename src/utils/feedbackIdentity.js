/**
 * Feedback identity utility functions
 * Handles anonymous ID generation, nickname sanitization, and localStorage persistence
 */

import {
  MAX_LEN,
  USER_IDENTITY_STORAGE_KEY,
  ANONYMOUS_CONTRIBUTOR_ID_PATTERN,
} from '../config/feedbackConfig';

// ─────────────────────────────────────────────────────────────
// Anonymous ID Generation
// ─────────────────────────────────────────────────────────────

/**
 * Generate a random anonymous contributor ID
 * Format: User#XXXX where X is hexadecimal
 * @returns {string} Anonymous ID
 */
export const createAnonymousContributorId = () => {
  if (
    typeof window !== 'undefined' &&
    window.crypto &&
    typeof window.crypto.getRandomValues === 'function'
  ) {
    const random = new Uint16Array(1);
    window.crypto.getRandomValues(random);
    return `User#${random[0].toString(16).toUpperCase().padStart(4, '0')}`;
  }

  // Fallback for environments without crypto
  const fallback = Math.floor(Math.random() * 0x10000);
  return `User#${fallback.toString(16).toUpperCase().padStart(4, '0')}`;
};

// ─────────────────────────────────────────────────────────────
// Nickname Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Get the character length of a contributor nickname
 * Uses Array.from to correctly count Unicode characters
 * @param {string} value - Nickname value
 * @returns {number} Character count
 */
export const getContributorNicknameLength = (value) => Array.from(String(value ?? '')).length;

/**
 * Sanitize contributor nickname draft
 * - Replaces newlines and tabs with spaces
 * - Truncates to max length
 * @param {string} value - Raw input value
 * @returns {string} Sanitized value
 */
export const sanitizeContributorNicknameDraft = (value) => {
  const cleaned = String(value ?? '').replace(/[\r\n\t]+/g, ' ');
  const chars = Array.from(cleaned);
  return chars.slice(0, MAX_LEN.contributorNickname).join('');
};

/**
 * Normalize contributor nickname
 * - Trims whitespace
 * - Falls back to anonymous ID if empty
 * @param {string} value - Sanitized value
 * @param {string} anonymousId - Fallback anonymous ID
 * @returns {string} Normalized nickname
 */
export const normalizeContributorNickname = (value, anonymousId) => {
  const normalized = sanitizeContributorNicknameDraft(value).trim();
  return normalized || anonymousId;
};

// ─────────────────────────────────────────────────────────────
// localStorage Persistence
// ─────────────────────────────────────────────────────────────

/**
 * Load feedback identity from localStorage
 * @returns {{ anonymousId: string, contributorNickname: string }}
 */
export const loadFeedbackIdentity = () => {
  const fallbackAnonymousId = createAnonymousContributorId();

  if (typeof window === 'undefined') {
    return {
      anonymousId: fallbackAnonymousId,
      contributorNickname: fallbackAnonymousId,
    };
  }

  try {
    const raw = localStorage.getItem(USER_IDENTITY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    const anonymousId =
      typeof parsed?.anonymousId === 'string' &&
      ANONYMOUS_CONTRIBUTOR_ID_PATTERN.test(parsed.anonymousId)
        ? parsed.anonymousId
        : fallbackAnonymousId;

    const draftNickname = sanitizeContributorNicknameDraft(parsed?.contributorNickname ?? '');
    const contributorNickname = draftNickname.trim() || anonymousId;

    return {
      anonymousId,
      contributorNickname,
    };
  } catch {
    return {
      anonymousId: fallbackAnonymousId,
      contributorNickname: fallbackAnonymousId,
    };
  }
};

/**
 * Save feedback identity to localStorage
 * @param {{ anonymousId?: string, contributorNickname?: string }} identity
 */
export const saveFeedbackIdentity = (identity) => {
  if (typeof window === 'undefined') return;

  try {
    const anonymousId =
      typeof identity?.anonymousId === 'string' &&
      ANONYMOUS_CONTRIBUTOR_ID_PATTERN.test(identity.anonymousId)
        ? identity.anonymousId
        : createAnonymousContributorId();

    localStorage.setItem(
      USER_IDENTITY_STORAGE_KEY,
      JSON.stringify({
        anonymousId,
        contributorNickname: sanitizeContributorNicknameDraft(
          identity?.contributorNickname ?? ''
        ),
      })
    );
  } catch {
    // Ignore storage failures and keep the form usable
  }
};
