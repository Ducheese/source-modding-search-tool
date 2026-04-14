/**
 * Feedback configuration constants
 * Contains feedback types, field definitions, and length limits
 */

// ─────────────────────────────────────────────────────────────
// Feedback Types Configuration
// ─────────────────────────────────────────────────────────────
export const FEEDBACK_TYPES = [
  {
    id: 'translation',
    label: 'Translation',
    icon: 'Translate',
    description: 'Help us improve translation quality.',
  },
  {
    id: 'bug',
    label: 'Bug Report',
    icon: 'BugReport',
    description: 'Report an issue you encountered.',
  },
  {
    id: 'feature',
    label: 'Feature Request',
    icon: 'Lightbulb',
    description: 'Suggest a new feature.',
  },
];

// ─────────────────────────────────────────────────────────────
// Length Limits
// ─────────────────────────────────────────────────────────────
export const MAX_LEN = {
  contributorNickname: 40,
  title: 200,
  description: 4000,
  steps: 2000,
  suggestion: 4000,
};

// ─────────────────────────────────────────────────────────────
// Identity Storage Keys
// ─────────────────────────────────────────────────────────────
export const USER_IDENTITY_STORAGE_KEY = 'userID';
export const ANONYMOUS_CONTRIBUTOR_ID_PATTERN = /^User#[A-F0-9]{4}$/;

// ─────────────────────────────────────────────────────────────
// Bug Report Fields Configuration
// ─────────────────────────────────────────────────────────────
export const BUG_FIELDS = {
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
};

// ─────────────────────────────────────────────────────────────
// Feature Request Fields Configuration
// ─────────────────────────────────────────────────────────────
export const FEATURE_FIELDS = {
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
};
