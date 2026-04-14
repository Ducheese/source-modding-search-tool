import { useState, useCallback, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';

/**
 * Changelog 获取与管理 Hook
 * @param {Object} options
 * @param {boolean} options.open - 对话框是否打开
 * @param {function} options.t - 翻译函数
 * @returns {{ changelog: object, currentVersion: string, hasUpdate: boolean, isLoading: boolean, load: function }}
 */
export function useChangelog({ open, t } = {}) {
  // null = 未加载, 'loading' = 加载中, 'error' = 错误, 'ratelimit' = GitHub 限流, array = 成功
  const [changelog, setChangelog] = useState(null);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [hasUpdate, setHasUpdate] = useState(false);

  const load = useCallback(async () => {
    setChangelog('loading');
    setHasUpdate(false);

    // 获取当前版本
    const v = await getVersion().catch(() => null);
    setCurrentVersion(v);

    try {
      const res = await fetch('https://api.github.com/repos/Ducheese/source-modding-search-tool/releases');
      const data = await res.json();

      if (!Array.isArray(data)) {
        const isRateLimit = (data?.message ?? '').toLowerCase().includes('rate limit');
        setChangelog(isRateLimit ? 'ratelimit' : 'error');
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

      setChangelog(parsed);

      // 检查是否有更新
      const latestDate = parsed[0]?.date;
      const currentRelease = parsed.find(r => r.tag.replace(/^v/, '') === v);
      const currentDate = currentRelease?.date;
      setHasUpdate(!!(latestDate && currentDate && latestDate > currentDate));
    } catch {
      setChangelog('error');
    }
  }, [t]);

  // 首次打开时加载
  useEffect(() => {
    if (open && changelog === null) {
      load();
    }
  }, [open, changelog, load]);

  // 关闭时重置错误态（下次打开可自动重试）
  useEffect(() => {
    if (!open && (changelog === 'error' || changelog === 'ratelimit')) {
      setChangelog(null);
    }
  }, [open, changelog]);

  const isLoading = changelog === 'loading';
  const isError = changelog === 'error';
  const isRateLimited = changelog === 'ratelimit';
  const releases = Array.isArray(changelog) ? changelog : [];

  return {
    changelog,
    releases,
    currentVersion,
    hasUpdate,
    isLoading,
    isError,
    isRateLimited,
    load,
  };
}
