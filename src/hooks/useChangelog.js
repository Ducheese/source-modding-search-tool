import { useState, useCallback, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';

/**
 * Changelog 加载状态枚举
 * 使用对象替代字符串字面量，提高类型安全性
 */
const LoadStatus = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  RATE_LIMIT: 'rate_limit',
};

/**
 * Changelog 获取与管理 Hook
 * @param {Object} options
 * @param {boolean} options.open - 对话框是否打开
 * @param {function} options.t - 翻译函数
 * @returns {{ releases: array, currentVersion: string, hasUpdate: boolean, isLoading: boolean, isError: boolean, isRateLimited: boolean, load: function }}
 */
export function useChangelog({ open, t } = {}) {
  // 使用枚举状态 + 数据分离的设计
  const [status, setStatus] = useState(LoadStatus.IDLE);
  const [releases, setReleases] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [hasUpdate, setHasUpdate] = useState(false);

  const load = useCallback(async () => {
    setStatus(LoadStatus.LOADING);
    setHasUpdate(false);

    // 获取当前版本
    const v = await getVersion().catch(() => null);
    setCurrentVersion(v);

    try {
      const res = await fetch('https://api.github.com/repos/Ducheese/source-modding-search-tool/releases');
      const data = await res.json();

      if (!Array.isArray(data)) {
        const isRateLimit = (data?.message ?? '').toLowerCase().includes('rate limit');
        setStatus(isRateLimit ? LoadStatus.RATE_LIMIT : LoadStatus.ERROR);
        return;
      }

      const parsed = data.map(r => ({
        tag: r.tag_name,
        name: r.name || r.tag_name,
        body: (r.body || t?.('help.changelog.noBody') || 'No description provided.')
          .replace(/<img\b[^>]*>/gi, '') // 移除图片标签
          .trim(),
        date: r.published_at ? r.published_at.slice(0, 10) : null,
      }));

      setReleases(parsed);
      setStatus(LoadStatus.SUCCESS);

      // 检查是否有更新
      const latestDate = parsed[0]?.date;
      const currentRelease = parsed.find(r => r.tag.replace(/^v/, '') === v);
      const currentDate = currentRelease?.date;
      setHasUpdate(!!(latestDate && currentDate && latestDate > currentDate));
    } catch {
      setStatus(LoadStatus.ERROR);
    }
  }, [t]);

  // 首次打开时加载
  useEffect(() => {
    if (open && status === LoadStatus.IDLE) {
      load();
    }
  }, [open, status, load]);

  // 关闭时重置错误态（下次打开可自动重试）
  useEffect(() => {
    if (!open && (status === LoadStatus.ERROR || status === LoadStatus.RATE_LIMIT)) {
      setStatus(LoadStatus.IDLE);
    }
  }, [open, status]);

  const isLoading = status === LoadStatus.LOADING;
  const isError = status === LoadStatus.ERROR;
  const isRateLimited = status === LoadStatus.RATE_LIMIT;

  return {
    releases,
    currentVersion,
    hasUpdate,
    isLoading,
    isError,
    isRateLimited,
    load,
  };
}
