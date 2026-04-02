/**
 * useTranslationKeys.js
 * Hook for fetching and parsing translation VDF files
 * Handles caching, aborting requests, and error recovery
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSnackbar } from '../App';
import { parseVdf } from './vdfParser';

// Global cache that persists across component unmounts
const globalTranslationCache = new Map();

/**
 * Hook for loading and caching translation keys
 * @param {string} langId - Language ID (e.g., 'zh-CN', 'en')
 * @returns {Object} { translationMap, keyOptions, isLoading, error }
 */
export const useTranslationKeys = (langId) => {
  const showSnackbar = useSnackbar();
  const [translationMap, setTranslationMap] = useState(new Map());
  const [keyOptions, setKeyOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);

  const loadTranslationFile = useCallback(async () => {
    if (!langId) {
      setTranslationMap(new Map());
      setKeyOptions([]);
      setError(null);
      return;
    }

    // Reset error state before any operation
    setError(null);

    // Return cached data if available (global cache persists across unmounts)
    if (globalTranslationCache.has(langId)) {
      const cached = globalTranslationCache.get(langId);
      setTranslationMap(cached);
      setKeyOptions(
        Array.from(cached.entries()).map(([key, value]) => ({ key, value }))
      );
      setIsLoading(false);
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.PUBLIC_URL}/lang/${langId}.txt`, {
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      const parsed = parseVdf(text);

      // Extract Tokens section as Map
      const tokensMap = new Map();
      if (parsed.Tokens && typeof parsed.Tokens === 'object') {
        Object.entries(parsed.Tokens).forEach(([key, value]) => {
          tokensMap.set(key, value);
        });
      }

      // Cache the result in global cache
      globalTranslationCache.set(langId, tokensMap);
      setTranslationMap(tokensMap);
      setKeyOptions(
        Array.from(tokensMap.entries()).map(([key, value]) => ({ key, value }))
      );
    } catch (err) {
      // Ignore abort errors (they're expected)
      if (err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      showSnackbar(
        `Failed to load language file for "${langId}": ${errorMessage}`,
        'error'
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [langId, showSnackbar]);

  // Load translation file when langId changes
  useEffect(() => {
    loadTranslationFile();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadTranslationFile]);

  return {
    translationMap,
    keyOptions,
    isLoading,
    error,
  };
};
