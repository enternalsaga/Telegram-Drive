import { useCallback, useEffect, useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TouchFileList } from '../../src/components/mobile/TouchFileList';
import type { TelegramFile } from '../../src/types';

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];
  readonly observed: Element[] = [];
  readonly observe = vi.fn((element: Element) => this.observed.push(element));
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverMock.instances.push(this);
  }

  resize(width: number) {
    this.callback(this.observed.map(target => ({ target, contentRect: { width, height: 500 } } as ResizeObserverEntry)), this as unknown as ResizeObserver);
  }
}

const files: TelegramFile[] = Array.from({ length: 7 }, (_, index) => ({
  id: index + 1,
  name: `file-${index + 1}.txt`,
  size: 100,
  sizeStr: '100 B',
  folder_id: 1,
  mime_type: 'text/plain',
}));

interface FileListCallbacks {
  onDownload: ReturnType<typeof vi.fn>;
  onPreview: ReturnType<typeof vi.fn>;
  onBulkDownload: ReturnType<typeof vi.fn>;
  onBulkDelete: ReturnType<typeof vi.fn>;
  onBulkMove: ReturnType<typeof vi.fn>;
}

function FileListHarness({ initialFiles = files, callbacks }: { initialFiles?: TelegramFile[]; callbacks: FileListCallbacks }) {
  const [visibleFiles, setVisibleFiles] = useState(initialFiles);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeFolderId, setActiveFolderId] = useState(1);
  useEffect(() => setSelectedIds([]), [activeFolderId]);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const setScrollElement = useCallback((element: HTMLDivElement | null) => {
    scrollElementRef.current = element;
    if (!element) return;
    Object.defineProperties(element, {
      clientHeight: { configurable: true, value: 500 },
      clientWidth: { configurable: true, value: 288 },
      offsetHeight: { configurable: true, value: 500 },
      offsetWidth: { configurable: true, value: 288 },
    });
    element.getBoundingClientRect = () => ({
      bottom: 500, height: 500, left: 0, right: 288, top: 0, width: 288, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  }, []);

  return (
    <div ref={setScrollElement}>
      <button type="button" onClick={() => {
        setVisibleFiles([{ ...files[6], folder_id: 2 }]);
        setActiveFolderId(2);
      }}>Show different folder</button>
      <TouchFileList
        files={visibleFiles}
        isLoading={false}
        onDownload={callbacks.onDownload}
        onDelete={vi.fn()}
        onPreview={callbacks.onPreview}
        onRename={vi.fn()}
        selectedIds={selectedIds}
        onToggleSelection={(id) => setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])}
        onSelectAll={vi.fn()}
        onClearSelection={() => setSelectedIds([])}
        onBulkDelete={() => callbacks.onBulkDelete(selectedIds, activeFolderId)}
        onBulkDownload={() => callbacks.onBulkDownload(selectedIds, activeFolderId)}
        onBulkMove={(targetFolderId) => callbacks.onBulkMove(selectedIds, activeFolderId, targetFolderId)}
        folders={[]}
        activeFolderId={activeFolderId}
        scrollElementRef={scrollElementRef}
        viewMode="grid"
      />
      <output data-testid="selected-ids">{selectedIds.join(',')}</output>
    </div>
  );
}

function createCallbacks(): FileListCallbacks {
  return { onDownload: vi.fn(), onPreview: vi.fn(), onBulkDownload: vi.fn(), onBulkDelete: vi.fn(), onBulkMove: vi.fn() };
}

describe('TouchFileList grid selection', () => {
  afterEach(() => {
    ResizeObserverMock.instances = [];
    vi.unstubAllGlobals();
  });

  it('keeps all seven file IDs through two- and three-column layouts in the virtualizer path', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const { container } = render(<FileListHarness callbacks={createCallbacks()} />);

    act(() => ResizeObserverMock.instances.forEach(observer => observer.resize(288)));
    await waitFor(() => expect(container.querySelectorAll('[data-select-id]')).toHaveLength(7));
    expect(new Set([...container.querySelectorAll('[data-select-id]')].map(element => element.getAttribute('data-select-id'))))
      .toEqual(new Set(['1', '2', '3', '4', '5', '6', '7']));
    expect(container.querySelectorAll('[data-select-id]')).toHaveLength(7);
    const twoColumnGrid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
    expect(twoColumnGrid).not.toBeNull();
    expect(twoColumnGrid?.style.gridTemplateColumns).toContain('repeat(2');

    act(() => ResizeObserverMock.instances.forEach(observer => observer.resize(360)));
    expect(new Set([...container.querySelectorAll('[data-select-id]')].map(element => element.getAttribute('data-select-id'))))
      .toEqual(new Set(['1', '2', '3', '4', '5', '6', '7']));
    expect(container.querySelectorAll('[data-select-id]')).toHaveLength(7);
    const threeColumnGrid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
    expect(threeColumnGrid).not.toBeNull();
    expect(threeColumnGrid?.style.gridTemplateColumns).toContain('repeat(3');
  });

  it('clears prior-folder selection so bulk actions cannot use stale IDs', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const callbacks = createCallbacks();
    render(<FileListHarness callbacks={callbacks} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    await screen.findByRole('button', { name: 'file-1.txt' });
    fireEvent.click(screen.getByRole('button', { name: 'file-1.txt' }));
    expect(screen.getByTestId('selected-ids').textContent).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Show different folder' }));
    expect(screen.getByTestId('selected-ids').textContent).toBe('');
    expect(screen.queryByRole('button', { name: /Download \(/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete \(/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Move \(/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'file-7.txt' }));
    expect(screen.getByTestId('selected-ids').textContent).toBe('7');
    expect(callbacks.onPreview).not.toHaveBeenCalled();
    expect(callbacks.onDownload).not.toHaveBeenCalled();
    expect(callbacks.onBulkDownload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Download (1)' }));
    expect(callbacks.onBulkDownload).toHaveBeenCalledOnce();
    expect(callbacks.onBulkDownload).toHaveBeenCalledWith([7], 2);
    fireEvent.click(screen.getByRole('button', { name: 'Delete (1)' }));
    expect(callbacks.onBulkDelete).toHaveBeenCalledWith([7], 2);
    fireEvent.click(screen.getByRole('button', { name: 'Move (1)' }));
    fireEvent.click(screen.getByRole('button', { name: /Saved Messages/ }));
    expect(callbacks.onBulkMove).toHaveBeenCalledWith([7], 2, null);
    expect(callbacks.onDownload).not.toHaveBeenCalled();
  });

  it('exposes a touch-sized action button for every visible grid file', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const callbacks = createCallbacks();
    render(<FileListHarness callbacks={callbacks} />);

    const action = await screen.findByRole('button', { name: 'Actions for file-1.txt' });

    expect(action.className).toContain('h-11');
    expect(action.className).toContain('w-11');
    expect(action.closest('[role="button"]')).toBeNull();
    fireEvent.keyDown(action, { key: 'Enter' });
    expect(callbacks.onPreview).not.toHaveBeenCalled();
  });
});
