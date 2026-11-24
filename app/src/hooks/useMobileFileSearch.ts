import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SEARCH_FILTERS, filterAndRankFiles, type FileSearchFilters } from '../services/fileSearch';
import type { TelegramFile } from '../types';

export function useMobileFileSearch(files: TelegramFile[], folderId: number | null) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FileSearchFilters>(DEFAULT_SEARCH_FILTERS);
  const previousFolderId = useRef(folderId);

  useEffect(() => {
    if (previousFolderId.current === folderId) return;
    previousFolderId.current = folderId;
    setQuery('');
    setFilters(DEFAULT_SEARCH_FILTERS);
  }, [folderId]);

  const results = useMemo(
    () => filterAndRankFiles(files, query, filters),
    [files, filters, query],
  );

  const reset = () => {
    setQuery('');
    setFilters(DEFAULT_SEARCH_FILTERS);
  };

  return { query, setQuery, filters, setFilters, results, reset };
}
