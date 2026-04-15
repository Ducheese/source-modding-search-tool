/**
 * useTranslationKeys.js
 * Hook for fetching and parsing translation VDF files
 * Handles caching, aborting requests, and error recovery
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { parseVdf } from '../utils/vdfParser';

// Global cache that persists across component unmounts
const globalTranslationCache = new Map();

/**
 * Convert translation map to sorted key options array
 */
const toKeyOptions = (map) =>
  Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }));

/**
 * Hook for loading and caching translation keys
 * @param {string} langId - Language ID (e.g., 'zh-CN', 'en')
 * @returns {Object} { translationMap, keyOptions, isLoading, error }
 */
export const useTranslationKeys = (langId) => {
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
      setIsLoading(false);
      return;
    }

    setError(null);

    // Return cached data if available (global cache persists across unmounts)
    if (globalTranslationCache.has(langId)) {
      const cached = globalTranslationCache.get(langId);
      setTranslationMap(cached);
      setKeyOptions(toKeyOptions(cached));
      setIsLoading(false);
      return;
    }

    // Clear stale data before loading a new uncached language
    setTranslationMap(new Map());
    setKeyOptions([]);
    setIsLoading(true);

    // Create controller and track it locally for race condition handling
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${process.env.PUBLIC_URL}/lang/${langId}.txt`, {
        signal: controller.signal,
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
      setKeyOptions(toKeyOptions(tokensMap));
    } catch (err) {
      // Ignore abort errors (they're expected)
      if (err.name === 'AbortError') return;

      const errorMessage = err instanceof Error ? err.message : String(err);
      // Clear data on error to prevent stale data from showing
      setTranslationMap(new Map());
      setKeyOptions([]);
      setError(errorMessage);
    } finally {
      // Only update state if this controller is still the current one
      // This prevents old requests from overwriting new request state
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [langId]);

  // Load translation file when langId changes
  useEffect(() => {
    loadTranslationFile();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
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
