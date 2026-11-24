import { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMobileBackHandlers } from '../../src/hooks/useMobileBackHandlers';

function HandlerHarness({ onNavigation, onSort, showSort = true }: { onNavigation: () => void; onSort: () => void; showSort?: boolean }) {
  const { registerBackHandler } = useMobileBackHandlers(true);

  useEffect(() => registerBackHandler('navigation', 10, onNavigation), [onNavigation, registerBackHandler]);
  useEffect(() => showSort ? registerBackHandler('sort', 100, onSort) : undefined, [onSort, registerBackHandler, showSort]);
  return null;
}

describe('useMobileBackHandlers', () => {
  it('closes the highest-priority handler, then the next one after cleanup', () => {
    const onNavigation = vi.fn();
    const onSort = vi.fn();
    const { rerender } = render(<HandlerHarness onNavigation={onNavigation} onSort={onSort} />);

    expect(window.__telegramDriveHandleAndroidBack?.()).toBe(true);
    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onNavigation).not.toHaveBeenCalled();

    rerender(<HandlerHarness onNavigation={onNavigation} onSort={onSort} showSort={false} />);
    expect(window.__telegramDriveHandleAndroidBack?.()).toBe(true);
    expect(onNavigation).toHaveBeenCalledTimes(1);
  });

  it('removes the global callback on unmount and uses the latest callback after rerender', () => {
    const first = vi.fn();
    const replacement = vi.fn();
    const onSort = vi.fn();
    const { rerender, unmount } = render(<HandlerHarness onNavigation={first} onSort={onSort} showSort={false} />);

    rerender(<HandlerHarness onNavigation={replacement} onSort={onSort} showSort={false} />);
    act(() => { window.__telegramDriveHandleAndroidBack?.(); });
    expect(first).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledTimes(1);

    unmount();
    expect(window.__telegramDriveHandleAndroidBack).toBeUndefined();
  });
});
