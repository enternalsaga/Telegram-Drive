import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../../src/i18n';
import { MobileFileSearchToolbar } from '../../src/components/mobile/MobileFileSearchToolbar';

const defaultFilters = { scope: 'folder' as const, type: 'all' as const, size: 'any' as const, date: 'any' as const };

describe('MobileFileSearchToolbar', () => {
  it('does not present a partial streamed result count as complete', () => {
    const props = {
      query: '',
      onQueryChange: vi.fn(),
      filters: defaultFilters,
      onFiltersChange: vi.fn(),
      onReset: vi.fn(),
      resultCount: 5,
    };
    const { rerender } = render(
      <MobileFileSearchToolbar
        {...props}
        isLoading
      />,
    );

    const status = screen.getByText('Loading...');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('5 results')).toBeNull();

    rerender(<MobileFileSearchToolbar {...props} isLoading={false} />);
    expect(screen.getByText('5 results').getAttribute('aria-busy')).toBe('false');
  });
});
