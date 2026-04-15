import { tauriAPI } from './tauriBridge';

/**
 * 搜索服务
 * 调用 Rust 搜索 API 并适配结果格式
 */

export const searchInFiles = async (files, searchOptions) => {
  const startTime = Date.now();

  let rustResponse = { files: [], filtered_file_count: 0 };
  try {
    rustResponse = await tauriAPI.searchInFiles(files, searchOptions);
  } catch (error) {
    console.error("Rust search error:", error);
    throw new Error(`Search failed: ${error}`);
  }

  const rustResults = rustResponse.files || [];
  const filteredFileCount = rustResponse.filtered_file_count || 0;

  const totalMatches = rustResults.reduce((acc, file) => acc + file.matches.length, 0);

  const results = {
    query: searchOptions.query,
    options: searchOptions,
    inputFiles: files.length,
    totalFiles: filteredFileCount,
    matchedFiles: rustResults.length,
    totalMatches: totalMatches,
    files: rustResults,
    executionTime: Date.now() - startTime,
  };

  return results;
};
