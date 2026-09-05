import { useRef, useState, useCallback, useEffect, useMemo, type RefObject } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { DownloadCloud, Trash2, Pencil, CheckSquare, X, Check, FolderInput, MoreVertical, Eye, Link, Copy, Pin, PinOff } from 'lucide-react';
import { FileTypeIcon } from '../shared/FileTypeIcon';
import { ActionPopover, ActionItem } from './ActionPopover';
import { TelegramFile, TelegramFolder } from '../../types';
import { forgetThumbnail, getCachedThumbnail, loadThumbnail } from '../../services/imagePreviewCache';
import { isImageFile, isVideoFile } from '../../utils';
import i18n from '../../i18n';

/// Poster for an image or video row, falling back to the file-type icon while
/// it loads or when Telegram has none. Same source as the desktop grid, so the
/// on-disk cache is shared between the two.
function RowThumbnail({ file, activeFolderId, variant = 'row' }: {
  file: TelegramFile;
  activeFolderId: number | null;
  variant?: 'row' | 'tile';
}) {
  const hasPoster = file.type !== 'folder'
    && (isImageFile(file.name, file.mime_type) || isVideoFile(file.name, file.mime_type));
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPoster) return;
    let cancelled = false;
    setSrc(getCachedThumbnail(file.id, activeFolderId));
    loadThumbnail(file.id, activeFolderId).then((result) => {
      if (!cancelled && result) setSrc(result);
    }).catch(() => {
      // The icon stays; a missing poster is not an error worth surfacing.
    });
    return () => { cancelled = true; };
  }, [file.id, hasPoster, activeFolderId]);

  if (!src) {
    return variant === 'tile'
      ? <div className="flex h-full w-full items-center justify-center"><FileTypeIcon filename={file.name} size="lg" /></div>
      : <FileTypeIcon filename={file.name} />;
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      className={variant === 'tile'
        ? 'h-full w-full bg-telegram-border/20 object-cover'
        : 'h-10 w-10 rounded-lg bg-telegram-border/30 object-cover'}
      onError={() => {
        forgetThumbnail(file.id, activeFolderId);
        setSrc(null);
      }}
    />
  );
}

interface TouchFileListProps {
  files: TelegramFile[];
  isLoading: boolean;
  onDownload: (file: TelegramFile) => void;
  onDelete: (file: TelegramFile) => void;
  onPreview: (file: TelegramFile) => void;
  onRename: (file: TelegramFile) => void;
  selectedIds: number[];
  onToggleSelection: (id: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkDownload: () => void;
  onBulkMove: (targetFolderId: number | null) => void;
  onBulkShare?: () => void;
  onShare?: (file: TelegramFile) => void;
  onCopyTelegramLink?: (file: TelegramFile) => void;
  onKeepOffline?: (file: TelegramFile) => void;
  onRemoveOffline?: (file: TelegramFile) => void;
  folders: TelegramFolder[];
  activeFolderId: number | null;
  scrollElementRef: RefObject<HTMLElement | null>;
  disableVirtualization?: boolean;
  viewMode?: 'list' | 'grid';
}

export function TouchFileList({ files, isLoading, onDownload, onDelete, onPreview, onRename, selectedIds, onToggleSelection, onSelectAll, onClearSelection, onBulkDelete, onBulkDownload, onBulkMove, onBulkShare, onShare, onCopyTelegramLink, onKeepOffline, onRemoveOffline, folders, activeFolderId, scrollElementRef, disableVirtualization = false, viewMode = 'list' }: TouchFileListProps) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [actionMenuFile, setActionMenuFile] = useState<TelegramFile | null>(null);
  const isSelectionActive = selectionMode || selectedIds.length > 0;

  // Long-press detection refs
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const LONG_PRESS_DURATION = 500;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  // Drag-to-select ("paint"): pressing a row/tile and dragging toggles every
  // item the finger passes to one value. Refs mirror props so the move handler
  // reads fresh selection state without re-subscribing mid-drag.
  const selectedIdSetRef = useRef(selectedIdSet);
  selectedIdSetRef.current = selectedIdSet;
  const paintRef = useRef<{ value: boolean; started: boolean; visited: Set<number>; startId: number } | null>(null);
  const paintDownRef = useRef({ x: 0, y: 0 });
  const paintPosRef = useRef({ x: 0, y: 0 });
  const paintFiredAtRef = useRef(0);
  const autoScrollRef = useRef<number | null>(null);

  useEffect(() => {
    const updateScrollMargin = () => {
      const list = listRef.current;
      const scrollElement = scrollElementRef.current;
      if (!list || !scrollElement) return;
      const listRect = list.getBoundingClientRect();
      const scrollRect = scrollElement.getBoundingClientRect();
      setScrollMargin(listRect.top - scrollRect.top + scrollElement.scrollTop);
    };
    updateScrollMargin();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollMargin);
    if (listRef.current) {
      observer?.observe(listRef.current);
      if (listRef.current.parentElement) observer?.observe(listRef.current.parentElement);
    }
    if (scrollElementRef.current) observer?.observe(scrollElementRef.current);
    window.addEventListener('resize', updateScrollMargin);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateScrollMargin);
    };
  }, [files.length, isSelectionActive, scrollElementRef]);

  // Tiles are laid out three to a row on a phone, so the virtualizer counts
  // rows of tiles instead of files and a long folder stays as cheap to scroll.
  const isGrid = viewMode === 'grid';
  const gridColumns = 3;
  const rowCount = isGrid ? Math.ceil(files.length / gridColumns) : files.length;

  const rowVirtualizer = useVirtualizer({
    enabled: !disableVirtualization,
    count: rowCount,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => (isGrid ? 148 : 82),
    overscan: 10,
    gap: 10,
    paddingEnd: 80,
    getItemKey: index => (isGrid ? `row-${index}` : files[index]?.id ?? index),
    scrollMargin,
  });

  // Long-press handlers — defined BEFORE any early returns to satisfy Rules of Hooks.
  // On Android, long-press opens the action popover (file options menu).
  const handlePointerDown = useCallback((e: React.PointerEvent, file: TelegramFile) => {
    if (isSelectionActive) return;
    longPressFiredRef.current = false;
    longPressPosRef.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      // Haptic feedback — short vibration pulse (Web Vibration API, supported in Android WebView)
      navigator.vibrate?.(15);
      setActionMenuFile(file);
    }, LONG_PRESS_DURATION);
  }, [isSelectionActive]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!longPressPosRef.current || !longPressTimerRef.current) return;
    const dx = Math.abs(e.clientX - longPressPosRef.current.x);
    const dy = Math.abs(e.clientY - longPressPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      longPressPosRef.current = null;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressPosRef.current = null;
  }, []);

  const idUnderPoint = useCallback((x: number, y: number) => {
    const item = document.elementFromPoint(x, y)?.closest('[data-select-id]');
    const raw = item?.getAttribute('data-select-id');
    return raw ? Number(raw) : null;
  }, []);

  // Toggle the item under the finger to the paint value, once per drag.
  const resolvePaint = useCallback((x: number, y: number) => {
    const paint = paintRef.current;
    if (!paint) return;
    if (!paint.started) {
      paint.started = true;
      if (selectedIdSetRef.current.has(paint.startId) !== paint.value) onToggleSelection(paint.startId);
      paint.visited.add(paint.startId);
    }
    const id = idUnderPoint(x, y);
    if (id !== null && !paint.visited.has(id)) {
      paint.visited.add(id);
      if (selectedIdSetRef.current.has(id) !== paint.value) onToggleSelection(id);
    }
    // A recent paint suppresses the click that fires on release, so it does not
    // toggle the last item back. performance.now() self-expires, so a drag that
    // ends off an item never poisons a later tap.
    paintFiredAtRef.current = performance.now();
  }, [idUnderPoint, onToggleSelection]);
  const resolvePaintRef = useRef(resolvePaint);
  resolvePaintRef.current = resolvePaint;

  // While painting, scrolling is suppressed (touch-action: none), so drag near
  // an edge auto-scrolls the list to keep a long folder reachable.
  const autoScrollTick = useCallback(() => {
    const paint = paintRef.current;
    const scroller = scrollElementRef.current;
    if (!paint?.started || !scroller) { autoScrollRef.current = null; return; }
    const rect = scroller.getBoundingClientRect();
    const band = 76;
    const { x, y } = paintPosRef.current;
    let delta = 0;
    if (y < rect.top + band) delta = -16;
    else if (y > rect.bottom - band) delta = 16;
    if (delta !== 0) {
      scroller.scrollTop += delta;
      resolvePaintRef.current(x, y);
    }
    autoScrollRef.current = requestAnimationFrame(autoScrollTick);
  }, [scrollElementRef]);

  const handleSelectPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isSelectionActive) return;
    const id = idUnderPoint(e.clientX, e.clientY);
    if (id === null) return;
    paintRef.current = { value: !selectedIdSetRef.current.has(id), started: false, visited: new Set(), startId: id };
    paintDownRef.current = { x: e.clientX, y: e.clientY };
    paintPosRef.current = { x: e.clientX, y: e.clientY };
  }, [isSelectionActive, idUnderPoint]);

  const handleSelectPointerMove = useCallback((e: React.PointerEvent) => {
    const paint = paintRef.current;
    if (!paint) return;
    paintPosRef.current = { x: e.clientX, y: e.clientY };
    if (!paint.started) {
      const dx = e.clientX - paintDownRef.current.x;
      const dy = e.clientY - paintDownRef.current.y;
      // Let a still tap fall through to onClick; only a real drag paints.
      if (Math.hypot(dx, dy) < 8) return;
      if (autoScrollRef.current === null) autoScrollRef.current = requestAnimationFrame(autoScrollTick);
    }
    resolvePaint(e.clientX, e.clientY);
  }, [resolvePaint, autoScrollTick]);

  const endPaint = useCallback(() => {
    const wasPainting = paintRef.current?.started;
    paintRef.current = null;
    if (autoScrollRef.current !== null) { cancelAnimationFrame(autoScrollRef.current); autoScrollRef.current = null; }
    if (wasPainting) paintFiredAtRef.current = performance.now();
  }, []);

  const clickWasPaint = useCallback(() => performance.now() - paintFiredAtRef.current < 400, []);

  useEffect(() => () => {
    if (autoScrollRef.current !== null) cancelAnimationFrame(autoScrollRef.current);
  }, []);

  // Build action items for a file's popover menu
  const buildFileActions = useCallback((file: TelegramFile): ActionItem[] => {
    const actions: ActionItem[] = [
      {
        label: 'Preview',
        icon: <Eye className="w-4 h-4" />,
        onClick: () => onPreview(file),
      },
      {
        label: 'Download',
        icon: <DownloadCloud className="w-4 h-4" />,
        onClick: () => onDownload(file),
      },
      {
        label: 'Rename',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => onRename(file),
      },
    ];
    if (file.type !== 'folder' && onKeepOffline) {
      actions.push({
        label: 'Keep offline',
        icon: <Pin className="w-4 h-4" />,
        onClick: () => onKeepOffline(file),
      });
    }
    if (file.type !== 'folder' && file.offline_available && onRemoveOffline) {
      actions.push({
        label: 'Remove offline copy',
        icon: <PinOff className="w-4 h-4" />,
        onClick: () => onRemoveOffline(file),
      });
    }
    if (file.type !== 'folder' && onShare) {
      actions.push({
        label: 'Share Link',
        icon: <Link className="w-4 h-4" />,
        onClick: () => onShare(file),
      });
    }
    // Telegram native t.me link (only for files in public channels with a username)
    if (file.type !== 'folder' && onCopyTelegramLink) {
      const folder = folders.find(f => f.id === file.folder_id) || folders.find(f => f.id === activeFolderId);
      const username = folder?.username || (folder as any)?.chat?.username || (folder as any)?.channel?.username;
      if (username) {
        actions.push({
          label: 'Copy Telegram Link',
          icon: <Copy className="w-4 h-4" />,
          onClick: () => onCopyTelegramLink(file),
        });
      }
    }
    actions.push({
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => onDelete(file),
      destructive: true,
    });
    return actions;
  }, [onPreview, onDownload, onRename, onDelete, onShare, onCopyTelegramLink, onKeepOffline, onRemoveOffline, folders, activeFolderId]);

  const renderFileTile = (file: TelegramFile) => {
    const isSelected = selectedIdSet.has(file.id);
    return (
      <button
        key={file.id}
        type="button"
        onPointerDown={(e) => handlePointerDown(e, file)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => {
          // A long press opens the action popover; the click that follows it
          // must not also open the file.
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
          }
          if (clickWasPaint()) return;
          if (isSelectionActive) onToggleSelection(file.id);
          else onPreview(file);
        }}
        data-select-id={file.id}
        className={`relative flex aspect-square min-w-0 flex-col overflow-hidden rounded-2xl border text-left transition-colors ${
          isSelected
            ? 'border-telegram-primary/60 bg-telegram-primary/10'
            : 'border-telegram-border/20 bg-telegram-surface/40'
        }`}
        aria-label={file.name}
        aria-pressed={isSelected}
      >
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <RowThumbnail file={file} activeFolderId={activeFolderId} variant="tile" />
        </div>
        <div className="shrink-0 bg-telegram-bg/75 px-2 py-1.5 backdrop-blur-sm">
          <p className="truncate text-[10px] font-semibold leading-tight text-telegram-text">{file.name}</p>
          <p className="mt-0.5 font-mono text-[9px] text-telegram-subtext/80">{file.sizeStr}</p>
        </div>
        {isSelected && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-telegram-primary text-black">
            <Check className="h-3 w-3" />
          </span>
        )}
      </button>
    );
  };

  const renderTileRow = (rowIndex: number, virtualRow?: VirtualItem) => {
    const rowFiles = files.slice(rowIndex * gridColumns, rowIndex * gridColumns + gridColumns);
    return (
      <div
        key={virtualRow ? virtualRow.key : `row-${rowIndex}`}
        data-index={virtualRow?.index}
        ref={virtualRow ? rowVirtualizer.measureElement : undefined}
        className="grid grid-cols-3 gap-2.5"
        style={virtualRow ? {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualRow.start - scrollMargin}px)`,
        } : undefined}
      >
        {rowFiles.map(renderFileTile)}
      </div>
    );
  };

  const renderFileRow = (file: TelegramFile, index: number, virtualRow?: VirtualItem) => {
    const isSelected = selectedIdSet.has(file.id);
    return (
      <div
        key={file.id}
        data-index={virtualRow ? index : undefined}
        ref={virtualRow ? rowVirtualizer.measureElement : undefined}
        role="button"
        tabIndex={0}
        onPointerDown={(e) => handlePointerDown(e, file)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => {
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
          }
          if (clickWasPaint()) return;
          if (isSelectionActive) onToggleSelection(file.id);
          else onPreview(file);
        }}
        data-select-id={file.id}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (isSelectionActive) onToggleSelection(file.id);
            else onPreview(file);
          }
        }}
        style={virtualRow ? {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualRow.start - scrollMargin}px)`,
        } : undefined}
        className={`flex items-center justify-between p-3.5 rounded-2xl bg-telegram-hover/15 border transition-all duration-200 cursor-pointer active:bg-telegram-hover/35 ${
          isSelected ? 'border-telegram-primary/50 bg-telegram-primary/10' : 'border-telegram-border/20'
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {isSelectionActive && (
            <div className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
              isSelected
                ? 'bg-telegram-primary border-telegram-primary text-black'
                : 'border-telegram-border/50 bg-transparent'
            }`}>
              {isSelected && <Check className="w-3.5 h-3.5" />}
            </div>
          )}
          <div className="flex-shrink-0">
            <RowThumbnail file={file} activeFolderId={activeFolderId} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-telegram-text truncate max-w-[150px] leading-snug">{file.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-telegram-subtext/80 font-medium font-mono">{file.sizeStr}</span>
              <span className="w-1 h-1 bg-telegram-border rounded-full" />
              <span className="text-[10px] text-telegram-subtext/80 font-medium">{file.created_at || 'Sync'}</span>
            </div>
          </div>
        </div>

        {!isSelectionActive && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setActionMenuFile(file);
            }}
            className="flex-shrink-0 p-2 rounded-xl hover:bg-telegram-hover/40 active:bg-telegram-hover/60 text-telegram-subtext/60 hover:text-telegram-subtext transition-all duration-200"
            aria-label={`Actions for ${file.name}`}
          >
            <MoreVertical className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
          <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-telegram-primary"></div>
          <p className="text-xs text-telegram-subtext font-semibold">Retrieving your files...</p>
        </div>
      )}

      {!isLoading && files.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center px-4">
          <div className="p-4 rounded-2xl bg-telegram-hover/10 text-telegram-subtext border border-telegram-border/10">
            📁
          </div>
          <h4 className="text-sm font-bold text-telegram-text">This folder is empty</h4>
          <p className="text-xs text-telegram-subtext max-w-xs leading-relaxed">
            Upload files or synchronise folders to begin managing content.
          </p>
        </div>
      )}

      {!isLoading && files.length > 0 && (
        <>
          {/* Selection mode toggle & batch action bar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              onClick={() => {
                if (isSelectionActive) {
                  onClearSelection();
                }
                setSelectionMode(!selectionMode);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-95 ${
                isSelectionActive
                  ? 'bg-telegram-primary/20 text-telegram-primary border border-telegram-primary/30'
                  : 'bg-telegram-hover/20 text-telegram-subtext border border-telegram-border/30'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {isSelectionActive ? `${selectedIds.length} selected` : 'Select'}
            </button>
            {isSelectionActive && (
              <>
                <button
                  onClick={onSelectAll}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold bg-telegram-hover/20 text-telegram-subtext border border-telegram-border/30 active:scale-95 transition-all duration-200"
                >
                  <Check className="w-3 h-3" />
                  {i18n.t("common.all")}
                </button>
                <button
                  onClick={onClearSelection}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold bg-telegram-hover/20 text-telegram-subtext border border-telegram-border/30 active:scale-95 transition-all duration-200"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              </>
            )}
          </div>

          {/* Batch action bar - visible when items are selected */}
          {isSelectionActive && selectedIds.length > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-center gap-2 p-2.5 mb-3 rounded-2xl bg-telegram-primary/10 border border-telegram-primary/20 backdrop-blur-md animate-in slide-in-from-top-2">
              <button
                onClick={onBulkDownload}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-telegram-primary/20 text-telegram-primary border border-telegram-primary/30 active:scale-95 transition-all duration-200"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                Download ({selectedIds.length})
              </button>
              <button
                onClick={() => setShowMovePicker(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 active:scale-95 transition-all duration-200"
              >
                <FolderInput className="w-3.5 h-3.5" />
                Move ({selectedIds.length})
              </button>
              {onBulkShare && (
                <button
                  onClick={onBulkShare}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30 active:scale-95 transition-all duration-200"
                >
                  <Link className="w-3.5 h-3.5" />
                  Share ({selectedIds.length})
                </button>
              )}
              <button
                onClick={onBulkDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 active:scale-95 transition-all duration-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedIds.length})
              </button>
            </div>
          )}

          {/* Move-to-folder picker modal */}
          {showMovePicker && (
            <div
              className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMovePicker(false)}
            >
              <div
                className="bg-[#1c1c1c] border border-white/10 rounded-2xl p-5 w-[300px] max-h-[60vh] flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white">{i18n.t("files.move")} {selectedIds.length} file{selectedIds.length !== 1 ? 's' : ''} to...</h3>
                  <button
                    onClick={() => setShowMovePicker(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-telegram-subtext"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                  {/* Saved Messages */}
                  <button
                    onClick={() => { onBulkMove(null); setShowMovePicker(false); }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      activeFolderId === null
                        ? 'bg-telegram-primary/10 text-telegram-primary'
                        : 'text-telegram-subtext hover:bg-white/5'
                    }`}
                  >
                    📁 Saved Messages
                  </button>
                  {folders
                    .filter(f => f.id !== activeFolderId)
                    .map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => { onBulkMove(folder.id); setShowMovePicker(false); }}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-telegram-subtext hover:bg-white/5 transition-all duration-200"
                      >
                        📁 {folder.name}
                      </button>
                    ))}
                  {folders.filter(f => f.id !== activeFolderId).length === 0 && (
                    <p className="text-xs text-telegram-subtext/60 text-center py-4">No other folders available</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* File list — no more swipeable list, just tap-friendly rows with ⋮ menu */}
          <div
            ref={listRef}
            onPointerDown={handleSelectPointerDown}
            onPointerMove={handleSelectPointerMove}
            onPointerUp={endPaint}
            onPointerCancel={endPaint}
            className={disableVirtualization ? (isGrid ? 'grid grid-cols-3 gap-2.5' : 'space-y-2.5') : 'relative'}
            style={{
              ...(disableVirtualization ? {} : { height: `${rowVirtualizer.getTotalSize()}px` }),
              // Suppress native scroll during selection so a drag paints instead;
              // edge auto-scroll covers reaching the rest of a long list.
              touchAction: isSelectionActive ? 'none' : undefined,
            }}
          >
            {disableVirtualization
              ? (isGrid
                ? files.map(renderFileTile)
                : files.map((file, index) => renderFileRow(file, index)))
              : rowVirtualizer.getVirtualItems().map((virtualRow) => (isGrid
                ? renderTileRow(virtualRow.index, virtualRow)
                : renderFileRow(files[virtualRow.index], virtualRow.index, virtualRow)))}
          </div>
        </>
      )}

      {/* Action popover for file operations */}
      {actionMenuFile && (
        <ActionPopover
          title={actionMenuFile.name}
          actions={buildFileActions(actionMenuFile)}
          onClose={() => setActionMenuFile(null)}
        />
      )}
    </>
  );
}
