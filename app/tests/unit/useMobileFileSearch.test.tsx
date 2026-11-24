import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useMobileFileSearch } from '../../src/hooks/useMobileFileSearch';
import type { TelegramFile } from '../../src/types';

const now = Date.now();
const files: TelegramFile[] = [
  { id: 1, name: 'Báo cáo.pdf', size: 2_000, sizeStr: '2 KB', created_at: new Date(now).toISOString() },
  { id: 2, name: 'holiday.mp4', size: 20 * 1024 * 1024, sizeStr: '20 MB', created_at: new Date(now - 10 * 86_400_000).toISOString() },
  { id: 3, name: 'archive.zip', size: 200 * 1024 * 1024, sizeStr: '200 MB', created_at: new Date(now - 400 * 86_400_000).toISOString() },
];

describe('useMobileFileSearch', () => {
  it('filters locally, includes streamed files, and resets when the folder changes', () => {
    const { result, rerender } = renderHook(({ nextFiles, folderId }) => useMobileFileSearch(nextFiles, folderId), {
      initialProps: { nextFiles: files, folderId: 1 },
    });

    act(() => result.current.setQuery('bao cao'));
    expect(result.current.results.map(file => file.id)).toEqual([1]);

    act(() => result.current.setFilters({ ...result.current.filters, type: 'video', size: 'medium', date: '30d' }));
    expect(result.current.results).toEqual([]);

    act(() => result.current.setQuery('holiday'));
    expect(result.current.results.map(file => file.id)).toEqual([2]);

    rerender({ nextFiles: [...files, { id: 4, name: 'holiday-notes.txt', size: 100, sizeStr: '100 B', created_at: new Date(now).toISOString() }], folderId: 1 });
    expect(result.current.results.map(file => file.id)).toEqual([2]);

    rerender({ nextFiles: files, folderId: 2 });
    expect(result.current.query).toBe('');
    expect(result.current.filters).toEqual({ scope: 'folder', type: 'all', size: 'any', date: 'any' });
    expect(result.current.results.map(file => file.id)).toEqual([1, 2, 3]);
  });

  it('clears selection on a query change and selects only visible results', () => {
    function SearchSelectionHarness() {
      const search = useMobileFileSearch(files, 1);
      const [selectedIds, setSelectedIds] = useState<number[]>([]);
      useEffect(() => setSelectedIds([]), [search.query, search.filters.type, search.filters.size, search.filters.date]);
      return <>
        <input aria-label="query" value={search.query} onChange={(event) => search.setQuery(event.target.value)} />
        <button type="button" onClick={() => setSelectedIds(search.results.map(file => file.id))}>Select visible</button>
        <output>{selectedIds.join(',')}</output>
      </>;
    }

    render(<SearchSelectionHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Select visible' }));
    expect(screen.getByRole('status').textContent).toBe('1,2,3');
    fireEvent.change(screen.getByRole('textbox', { name: 'query' }), { target: { value: 'holiday' } });
    expect(screen.getByRole('status').textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Select visible' }));
    expect(screen.getByRole('status').textContent).toBe('2');
  });
});
