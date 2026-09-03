import type { TelegramFile } from '../types';

export type SortField = 'name' | 'size' | 'date';
export type SortDirection = 'asc' | 'desc';

/**
 * Order a file list for display. Shared by the desktop explorer and the mobile
 * list so both honour the same `fileSortField` / `fileSortDirection` settings
 * and compare names the same way.
 *
 * Names compare under the active UI locale with numeric ordering, so "photo 2"
 * precedes "photo 10" and accented characters sort where a reader expects.
 * Returns a new array; the caller's list is left untouched.
 */
export function sortFiles(
  files: TelegramFile[],
  field: SortField,
  direction: SortDirection,
  locale?: string,
): TelegramFile[] {
  return [...files].sort((a, b) => {
    let comparison = 0;
    switch (field) {
      case 'name':
        comparison = a.name.localeCompare(b.name, locale, { numeric: true, sensitivity: 'base' });
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      case 'date':
        comparison = (a.created_at || '').localeCompare(b.created_at || '');
        break;
    }
    return direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Next sort state when the user picks a field: choosing the active field flips
 * the direction, choosing a different one starts ascending.
 */
export function nextSortState(
  current: { field: SortField; direction: SortDirection },
  picked: SortField,
): { field: SortField; direction: SortDirection } {
  if (picked !== current.field) return { field: picked, direction: 'asc' };
  return { field: picked, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}
