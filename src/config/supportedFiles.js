import { SUPPORTED_EXTENSIONS_STORAGE_KEY } from './storageKeys';

export const DEFAULT_SUPPORTED_EXTENSIONS = [
  'sp', 'cfg', 'ini', 'txt', 'vmt', 'qc',
  'inc', 'lua', 'log', 'vdf', 'scr', 'res', 'nut',
];

const EXTENSION_RE = /^[a-z0-9][a-z0-9_-]*$/i;

const isBrowser = typeof window !== 'undefined';

export function normalizeSupportedExtension(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');

  if (!normalized || !EXTENSION_RE.test(normalized)) {
    return '';
  }

  return normalized;
}

export function sanitizeSupportedExtensions(value, { fallbackToDefault = true } = {}) {
  if (!Array.isArray(value)) {
    return fallbackToDefault ? [...DEFAULT_SUPPORTED_EXTENSIONS] : [];
  }

  const unique = [];
  const seen = new Set();

  value.forEach((item) => {
    const normalized = normalizeSupportedExtension(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    unique.push(normalized);
  });

  if (!unique.length && fallbackToDefault) {
    return [...DEFAULT_SUPPORTED_EXTENSIONS];
  }

  return unique;
}

export function loadSupportedExtensions() {
  if (!isBrowser) {
    return [...DEFAULT_SUPPORTED_EXTENSIONS];
  }

  let raw = null;
  try {
    raw = localStorage.getItem(SUPPORTED_EXTENSIONS_STORAGE_KEY);
  } catch {
    return [...DEFAULT_SUPPORTED_EXTENSIONS];
  }

  if (!raw) {
    return [...DEFAULT_SUPPORTED_EXTENSIONS];
  }

  try {
    return sanitizeSupportedExtensions(JSON.parse(raw));
  } catch {
    return [...DEFAULT_SUPPORTED_EXTENSIONS];
  }
}

export function saveSupportedExtensions(nextExtensions) {
  const sanitized = sanitizeSupportedExtensions(nextExtensions);

  if (isBrowser) {
    try {
      localStorage.setItem(SUPPORTED_EXTENSIONS_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore persistence errors and still return the in-memory value
    }
  }

  return sanitized;
}

export function formatSupportedExtensions(extensions, { separator = 'space' } = {}) {
  const sanitized = sanitizeSupportedExtensions(extensions);
  const joiner = separator === 'comma' ? ', ' : ' ';
  return sanitized.map((ext) => `.${ext}`).join(joiner);
}

export function getSupportedExtensionsWithDot(extensions = loadSupportedExtensions()) {
  return sanitizeSupportedExtensions(extensions).map((ext) => `.${ext}`);
}
