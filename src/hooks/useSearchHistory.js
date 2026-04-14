import { useState, useCallback } from 'react';

export const SEARCH_HISTORY_STORAGE_KEY = 'searchHistory';
const MAX_HISTORY_SIZE = 30;

/**
 * 搜索历史管理 Hook
 * @returns {{ history: string[], save: function, clear: function }}
 */
export function useSearchHistory() {
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const save = useCallback((query) => {
    if (!query?.trim()) return;
    
    setHistory(prev => {
      // 移除重复项，将新查询放到最前面
      const newHistory = [query, ...prev.filter(h => h !== query)].slice(0, MAX_HISTORY_SIZE);
      localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
    setHistory([]);
  }, []);

  return { history, save, clear };
}
