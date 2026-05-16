import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getSupportedExtensionsWithDot,
  loadSupportedExtensions,
  normalizeSupportedExtension,
  saveSupportedExtensions,
} from '../config/supportedFiles';
import { SUPPORTED_EXTENSIONS_STORAGE_KEY } from '../config/storageKeys';

const SupportedExtensionsContext = createContext(null);

function areSameExtensions(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export const SupportedExtensionsProvider = ({ children }) => {
  const [extensions, setExtensionsState] = useState(() => loadSupportedExtensions());

  const setExtensions = useCallback((nextValue) => {
    setExtensionsState((prev) => {
      const resolved = typeof nextValue === 'function' ? nextValue(prev) : nextValue;
      const saved = saveSupportedExtensions(resolved);
      return areSameExtensions(prev, saved) ? prev : saved;
    });
  }, []);

  const addExtension = useCallback((rawValue) => {
    const normalized = normalizeSupportedExtension(rawValue);
    if (!normalized) return false;

    let didAdd = false;
    setExtensions((prev) => {
      if (prev.includes(normalized)) return prev;
      didAdd = true;
      return [...prev, normalized];
    });
    return didAdd;
  }, [setExtensions]);

  const removeExtension = useCallback((target) => {
    const normalized = normalizeSupportedExtension(target);
    if (!normalized) return false;

    let didRemove = false;
    setExtensions((prev) => {
      if (prev.length <= 1 || !prev.includes(normalized)) return prev;
      didRemove = true;
      return prev.filter((ext) => ext !== normalized);
    });
    return didRemove;
  }, [setExtensions]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== SUPPORTED_EXTENSIONS_STORAGE_KEY) return;
      setExtensionsState(loadSupportedExtensions());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(() => ({
    extensions,
    extensionsWithDot: getSupportedExtensionsWithDot(extensions),
    setExtensions,
    addExtension,
    removeExtension,
  }), [extensions, setExtensions, addExtension, removeExtension]);

  return (
    <SupportedExtensionsContext.Provider value={value}>
      {children}
    </SupportedExtensionsContext.Provider>
  );
};

export const useSupportedExtensions = () => {
  const context = useContext(SupportedExtensionsContext);
  if (!context) {
    throw new Error('useSupportedExtensions must be used within a SupportedExtensionsProvider');
  }
  return context;
};
