import { useRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMobileGridMetrics } from '../../src/hooks/useMobileGridMetrics';

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverMock.instances.push(this);
  }

  resize(width: number) {
    this.callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

function MetricsProbe({ showList = true }: { showList?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { columns, estimatedRowHeight } = useMobileGridMetrics(ref);
  return showList ? <div ref={ref} data-testid="grid-metrics" data-columns={columns} data-row-height={estimatedRowHeight} /> : null;
}

describe('useMobileGridMetrics', () => {
  afterEach(() => {
    ResizeObserverMock.instances = [];
    vi.unstubAllGlobals();
  });

  it('uses two columns until measured, then derives columns and square row height from content width', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    render(<MetricsProbe />);

    const grid = screen.getByTestId('grid-metrics');
    expect(grid.dataset.columns).toBe('2');

    act(() => ResizeObserverMock.instances[0].resize(288));
    expect(grid.dataset.columns).toBe('2');
    expect(grid.dataset.rowHeight).toBe('139');

    act(() => ResizeObserverMock.instances[0].resize(358));
    expect(grid.dataset.columns).toBe('2');
    expect(grid.dataset.rowHeight).toBe('174');

    act(() => ResizeObserverMock.instances[0].resize(360));
    expect(grid.dataset.columns).toBe('3');
    expect(grid.dataset.rowHeight).toBe('113.33333333333333');
  });

  it('disconnects its ResizeObserver when the list unmounts', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const { unmount } = render(<MetricsProbe />);
    const observer = ResizeObserverMock.instances[0];

    unmount();

    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it('starts observing after a loading or empty state later renders streamed files', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const { rerender } = render(<MetricsProbe showList={false} />);

    expect(ResizeObserverMock.instances).toHaveLength(0);

    rerender(<MetricsProbe showList />);
    const grid = screen.getByTestId('grid-metrics');
    const observer = ResizeObserverMock.instances[0];
    expect(observer.observe).toHaveBeenCalledWith(grid);

    act(() => observer.resize(358));
    expect(grid.dataset.columns).toBe('2');

    act(() => observer.resize(360));
    expect(grid.dataset.columns).toBe('3');
  });
});
