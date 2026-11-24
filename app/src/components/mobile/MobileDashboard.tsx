import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Trash2, Pencil, Link, Eye, EyeOff } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MobileDashboardHeader, MobileFileDisplayControls } from './MobileDashboardHeader';
import { MobileFolderToolbar } from './MobileFolderToolbar';
import { MobileFileSearchToolbar } from './MobileFileSearchToolbar';
import { MobileTransfersPanel } from './MobileTransfersPanel';
import { MobileSettingsPanel, type CachedFileEntry } from './MobileSettingsPanel';
import { MobileFolderDrawer } from './MobileFolderDrawer';
import { MobileDashboardOverlays } from './MobileDashboardOverlays';
import { useMobileSettingsDiagnostics } from '../../hooks/useMobileSettingsDiagnostics';
import { useMobileIncomingShares } from '../../hooks/useMobileIncomingShares';
import { useMobileTransferStatus } from '../../hooks/useMobileTransferStatus';
import { BottomNavBar } from './BottomNavBar';
import { TouchFileList } from './TouchFileList';
import AdsterraBanner from '../shared/AdsterraBanner';
import { SPONSOR_CONTENT_ENABLED } from '../../config/sponsorship';
import type { ActionItem } from './ActionPopover';
import { usePlatform } from '../../hooks/usePlatform';
import { useTelegramConnection } from '../../hooks/useTelegramConnection';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useFileDownload } from '../../hooks/useFileDownload';
import { useFileOperations } from '../../hooks/useFileOperations';
import { formatBytes, isMediaFile, isPdfFile, isImageFile, nativeShareOrCopy, copyToClipboard } from '../../utils';
import { TelegramFile, TelegramFolder, ShareInfo, BandwidthStats } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { useSupporter } from '../../context/SupporterContext';
import { useTranslation } from 'react-i18next';
import { evaluateAndroidTransferPolicy, type AndroidTransferEnvironment } from '../../services/androidTransferPolicy';
import { effectiveVideoUploadMode } from '../../services/videoUploadMode';
import { nextSortState, sortFiles, type SortField } from '../../services/fileSort';
import { useMobileBackHandlers } from '../../hooks/useMobileBackHandlers';
import { useMobileFileSearch } from '../../hooks/useMobileFileSearch';
import {
  shouldShowSupporterPrompt,
  SUPPORTER_VALUE_MOMENT_EVENT,
  type SupporterPromptTrigger,
} from '../../services/supporterVisibility';

interface AndroidPlaybackHistoryEntry {
  mediaId: string;
  title: string;
  positionMs: number;
  durationMs: number;
  completed: boolean;
  lastPlayedAt: number;
}

export default function MobileDashboard({ onLogout }: { onLogout?: () => void }) {
  const scrollRootRef = useRef<HTMLElement>(null);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'files' | 'downloads' | 'settings'>('files');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isAndroid, isTelevision } = usePlatform();
  const { registerBackHandler } = useMobileBackHandlers(isAndroid);
  const { settings, updateSetting, updateSettings, isLoaded: settingsLoaded } = useSettings();
  const { status: supporterStatus } = useSupporter();
  const [showHelp, setShowHelp] = useState(false);
  const [supporterOfferTrigger, setSupporterOfferTrigger] = useState<SupporterPromptTrigger | null>(null);

  useMobileIncomingShares(isAndroid);

  const logoutHandler = useMemo(() => onLogout || (() => {}), [onLogout]);

  const {
    store, folders, activeFolderId, setActiveFolderId, isSyncing, isConnected,
    handleLogout, handleSyncFolders, handleCreateFolder, handleFolderDelete,
    handleFolderRename, handleFolderToggleVisibility, handleExportFolderInvite
  } = useTelegramConnection(logoutHandler);

  const { data: androidTransferEnvironment } = useQuery({
    queryKey: ['android-transfer-environment'],
    queryFn: () => invoke<AndroidTransferEnvironment>('cmd_get_android_transfer_environment'),
    enabled: isAndroid,
    refetchInterval: isAndroid ? 60_000 : false,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (!isAndroid) return;
    const handleEnvironmentChange = (event: Event) => {
      const environment = (event as CustomEvent<AndroidTransferEnvironment>).detail;
      if (environment && typeof environment.connected === 'boolean') {
        queryClient.setQueryData(['android-transfer-environment'], environment);
      } else {
        void queryClient.invalidateQueries({ queryKey: ['android-transfer-environment'] });
      }
    };
    window.addEventListener('android-environment-change', handleEnvironmentChange);
    return () => window.removeEventListener('android-environment-change', handleEnvironmentChange);
  }, [isAndroid, queryClient]);
  const androidTransferGate = useMemo(
    () => evaluateAndroidTransferPolicy(androidTransferEnvironment, settings),
    [androidTransferEnvironment, settings],
  );
  const transferAllowed = !isAndroid || (isConnected && androidTransferGate.allowed);
  const transferWaitingReason = !isConnected
    ? 'Waiting for the Telegram connection'
    : androidTransferGate.reason ?? 'Waiting for Android transfer conditions';

  useEffect(() => {
    if (!isAndroid || !settingsLoaded) return;
    void invoke('cmd_configure_android_transfer_recovery', {
      wifiOnly: settings.androidWifiOnlyTransfers,
      allowRoaming: settings.androidAllowRoaming,
      requireCharging: settings.androidRequireCharging,
      pauseOnLowBattery: settings.androidPauseOnLowBattery,
    }).catch(error => console.warn('[Transfer] Unable to configure Android recovery:', error));
  }, [
    isAndroid,
    settings.androidAllowRoaming,
    settings.androidPauseOnLowBattery,
    settings.androidRequireCharging,
    settings.androidWifiOnlyTransfers,
    settingsLoaded,
  ]);

  const {
    uploadQueue, setUploadQueue, handleManualUpload, clearFinished: clearUploads,
    cancelAll: cancelUploads, pauseAll: pauseUploads, resumeAll: resumeUploads,
    cancelItem: cancelUpload, retryItem: retryUpload,
  } = useFileUpload(activeFolderId, store, transferAllowed, transferWaitingReason);
  const {
    downloadQueue, queueDownload, queueBulkDownload, clearFinished: clearDownloads,
    cancelAll: cancelDownloads, pauseAll: pauseDownloads, resumeAll: resumeDownloads,
    cancelItem: cancelDownload, retryItem: retryDownload,
  } = useFileDownload(store, transferAllowed, transferWaitingReason);

  const [playingFile, setPlayingFile] = useState<TelegramFile | null>(null);
  const [pdfFile, setPdfFile] = useState<TelegramFile | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [previewFile, setPreviewFile] = useState<TelegramFile | null>(null);
  const [shareFile, setShareFile] = useState<TelegramFile | null>(null);
  const [bulkShareLinks, setBulkShareLinks] = useState<Array<{ file: TelegramFile; link: string }> | null>(null);
  const [bulkShareLoading, setBulkShareLoading] = useState(false);
  const [bulkShareCopied, setBulkShareCopied] = useState<Set<string>>(new Set());
  const [uploadingCacheFiles, setUploadingCacheFiles] = useState<Set<string>>(new Set());
  const transferIdCounter = useRef(0);
  const { data: bandwidth } = useQuery({
    queryKey: ['bandwidth'],
    queryFn: () => invoke<BandwidthStats>('cmd_get_bandwidth'),
    refetchInterval: activeTab === 'settings' ? 5000 : false,
  });

  const diagnostics = useMobileSettingsDiagnostics(isAndroid, activeTab === 'settings');
  const { refetchOfflineCache } = diagnostics;

  // The in-app sponsor placement is TV-safe and remains available to free users.
  // Keep it suppressed during media, previews, dialogs, and active transfers so it
  // never covers playback controls or interrupts a bandwidth-sensitive operation.
  const adVisible = SPONSOR_CONTENT_ENABLED
    && !playingFile && !pdfFile && !previewFile && !shareFile && !bulkShareLinks
    && !showHelp && !supporterOfferTrigger && settings.driveTourSeen
    && !uploadQueue.some(item => ['pending', 'uploading', 'downloading', 'encrypting', 'verifying'].includes(item.status))
    && !downloadQueue.some(item => ['pending', 'cooldown', 'downloading', 'decrypting', 'verifying'].includes(item.status));

  const transferStatus = useMobileTransferStatus({
    isAndroid, settingsLoaded, uploadQueue, downloadQueue,
    pauseUploads, pauseDownloads, resumeUploads, resumeDownloads, cancelUploads, cancelDownloads,
  });
  const { activeUploadCount, activeDownloadCount, pausedUploadCount, pausedDownloadCount,
    networkWaitingCount, aggregateTransferSpeed } = transferStatus;

  // ── Android cached shared files ───────────────────────────────────────
  const { data: cachedFiles = [], refetch: refetchCachedFiles } = useQuery({
    queryKey: ['cached-files'],
    queryFn: () => invoke<CachedFileEntry[]>('cmd_list_cached_files'),
    enabled: isAndroid,
    refetchOnWindowFocus: true,
  });

  const handleUploadCachedFile = useCallback(async (entry: CachedFileEntry) => {
    const tid = `cache-upload-${++transferIdCounter.current}-${Date.now()}`;
    setUploadingCacheFiles(prev => new Set(prev).add(entry.cached_path));
    try {
      const stagedPath = await invoke<string>('cmd_stage_android_upload', { path: entry.cached_path });
      setUploadQueue(queue => [...queue, {
        id: tid,
        path: stagedPath,
        folderId: activeFolderId,
        status: 'pending',
        androidStaged: true,
        protection: { mode: 'standard' },
        videoUploadMode: effectiveVideoUploadMode(entry.file_name, { mode: 'standard' }, settings.videoUploadMode),
      }]);
      await invoke('cmd_remove_cached_path', { uri: entry.uri }).catch(() => undefined);
      await refetchCachedFiles();
      toast.success(`Queued: ${entry.file_name}`);
    } catch (e) {
      toast.error(`Could not preserve the shared file for upload: ${e}`);
    } finally {
      setUploadingCacheFiles(prev => {
        const next = new Set(prev);
        next.delete(entry.cached_path);
        return next;
      });
    }
  }, [activeFolderId, refetchCachedFiles, setUploadQueue, settings.videoUploadMode]);

  const handleClearCachedFiles = useCallback(async () => {
    try {
      await Promise.all(cachedFiles.map(entry =>
        invoke('cmd_remove_cached_path', { uri: entry.uri }).catch(() => {})
      ));
      refetchCachedFiles();
      toast.success('Shared files cleared');
    } catch (e) {
      toast.error(`Failed to clear: ${e}`);
    }
  }, [cachedFiles, refetchCachedFiles]);

  // Real files loader
  const { data: allFiles = [], isLoading, isFetching } = useQuery({
    queryKey: ['files', activeFolderId],
    queryFn: async () => {
      let accumulatedFiles: any[] = [];
      queryClient.setQueryData(['files', activeFolderId], []);

      const unlisten = await listen<any>('folder-load-chunk', (event) => {
        const payload = event.payload;
        if (payload.folderId === activeFolderId) {
          const newChunk = payload.files.map((f: any) => ({
            ...f,
            sizeStr: formatBytes(f.size),
            type: f.icon_type || (f.name.endsWith('/') ? 'folder' : 'file')
          }));
          accumulatedFiles = [...accumulatedFiles, ...newChunk];
          queryClient.setQueryData(['files', activeFolderId], accumulatedFiles);
        }
      });

      try {
        await invoke('cmd_get_files', { folderId: activeFolderId });
        return accumulatedFiles;
      } finally {
        unlisten();
      }
    },
    enabled: !!store,
  });

  const { data: playbackHistory = [] } = useQuery({
    queryKey: ['android-playback-history'],
    queryFn: () => invoke<AndroidPlaybackHistoryEntry[]>('cmd_get_android_playback_history'),
    enabled: isAndroid && activeTab === 'files',
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (!isAndroid) return;
    const refreshHistory = () => void queryClient.invalidateQueries({ queryKey: ['android-playback-history'] });
    window.addEventListener('android-playback-history-change', refreshHistory);
    return () => window.removeEventListener('android-playback-history-change', refreshHistory);
  }, [isAndroid, queryClient]);
  const continueWatching = useMemo(() => {
    const folderKey = String(activeFolderId ?? 'home');
    return playbackHistory.flatMap(entry => {
      if (entry.completed || entry.positionMs < 10_000 || !entry.mediaId.startsWith(`${folderKey}:`)) return [];
      const messageId = Number(entry.mediaId.slice(folderKey.length + 1));
      const file = allFiles.find(candidate => candidate.id === messageId);
      if (!file) return [];
      const progress = entry.durationMs > 0 ? Math.min(100, Math.round(entry.positionMs / entry.durationMs * 100)) : 0;
      return [{ entry, file, progress }];
    }).slice(0, 5);
  }, [activeFolderId, allFiles, playbackHistory]);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [fileRenames, setFileRenames] = useState<Map<number, string>>(new Map());
  const { handleDelete: handleDeleteOp, handleBulkDelete, handleBulkDownload, handleBulkMove } = useFileOperations(activeFolderId, selectedIds, setSelectedIds, allFiles, queueBulkDownload);

  const activeFolder = activeFolderId === null
    ? 'Saved Messages'
    : folders.find(f => f.id === activeFolderId)?.name || 'Unknown Channel';

  // Folder action menu state (replaces swipe-to-reveal)
  const [folderActionMenu, setFolderActionMenu] = useState<TelegramFolder | null>(null);
  const [renameFolder, setRenameFolder] = useState<{ id: number; name: string } | null>(null);

  const openMobileSupporter = useCallback(() => {
    setSupporterOfferTrigger(null);
    setActiveTab('settings');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById('mobile-supporter-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, []);

  const showSupporterOffer = useCallback((trigger: SupporterPromptTrigger) => {
    if (!settingsLoaded || !settings.driveTourSeen) return;
    if (!shouldShowSupporterPrompt(supporterStatus, settings.supporterPromptLastShownAt)) return;
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    if (playingFile || pdfFile || previewFile || shareFile || bulkShareLinks || showHelp
      || folderActionMenu || renameFolder || isSidebarOpen) return;

    updateSetting('supporterPromptLastShownAt', Date.now());
    setSupporterOfferTrigger(trigger);
  }, [
    bulkShareLinks,
    folderActionMenu,
    isSidebarOpen,
    pdfFile,
    playingFile,
    previewFile,
    renameFolder,
    settings.driveTourSeen,
    settings.supporterPromptLastShownAt,
    settingsLoaded,
    shareFile,
    showHelp,
    supporterStatus,
    updateSetting,
  ]);

  useEffect(() => {
    if (supporterStatus.ad_free) setSupporterOfferTrigger(null);
  }, [supporterStatus.ad_free]);

  useEffect(() => {
    const handleValueMoment = (event: Event) => {
      const moment = (event as CustomEvent<{ moment?: SupporterPromptTrigger }>).detail?.moment;
      if (moment === 'upload_completed' || moment === 'download_completed') {
        showSupporterOffer(moment);
      }
    };
    window.addEventListener(SUPPORTER_VALUE_MOMENT_EVENT, handleValueMoment);
    return () => window.removeEventListener(SUPPORTER_VALUE_MOMENT_EVENT, handleValueMoment);
  }, [showSupporterOffer]);

  const handleFolderVisibilityToggle = useCallback(async (folder: TelegramFolder) => {
    const isPublic = folder.is_public || !!folder.username;
    if (isPublic) {
      // Make private
      try {
        await handleFolderToggleVisibility(folder.id, false);
      } catch { /* error already toasted */ }
    } else {
      // Make public — prompt for optional username
      const defaultUsername = folder.name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
      const username = prompt(`Make "${folder.name}" public. Enter a username (leave empty for auto-generated):`, defaultUsername)?.trim();
      if (username === undefined) return; // cancelled
      try {
        await handleFolderToggleVisibility(folder.id, true, username || undefined);
      } catch { /* error already toasted */ }
    }
  }, [handleFolderToggleVisibility]);

  const handleFolderShareInvite = useCallback(async (folder: TelegramFolder) => {
    try {
      const info = await handleExportFolderInvite(folder.id);
      try {
        await copyToClipboard(info.link);
        toast.success(`Invite link copied: ${info.link}`);
      } catch (e) {
        toast.error(`Failed to copy to clipboard: ${e}`);
      }
    } catch { /* backend error already toasted in hook */ }
  }, [handleExportFolderInvite]);

  const buildFolderActions = useCallback((folder: TelegramFolder): ActionItem[] => {
    const isPublic = folder.is_public || !!folder.username;
    return [
      {
        label: 'Rename',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => {
          setFolderActionMenu(null);
          setRenameFolder({ id: folder.id, name: folder.name });
        },
      },
      {
        label: isPublic ? 'Make Private' : 'Make Public',
        icon: isPublic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
        onClick: () => handleFolderVisibilityToggle(folder),
      },
      {
        label: 'Copy Invite Link',
        icon: <Link className="w-4 h-4" />,
        onClick: () => handleFolderShareInvite(folder),
      },
      {
        label: 'Delete',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => handleFolderDelete(folder.id, folder.name),
        destructive: true,
      },
    ];
  }, [handleFolderDelete, handleFolderVisibilityToggle, handleFolderShareInvite]);

  const handleClearSelection = useCallback(() => setSelectedIds([]), []);

  const handleToggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const handleDownload = useCallback((file: TelegramFile) => {
    queueDownload(file.id, file.name, activeFolderId);
  }, [queueDownload, activeFolderId]);

  const handleDeleteFile = useCallback((file: TelegramFile) => {
    handleDeleteOp(file.id);
  }, [handleDeleteOp]);

  const handlePreview = useCallback((file: TelegramFile) => {
    if (isMediaFile(file.name, file.mime_type)) {
      setPlayingFile(file);
    } else if (isPdfFile(file.name)) {
      setPdfFile(file);
    } else if (isImageFile(file.name, file.mime_type)) {
      setPreviewFile(file);
    } else {
      toast.info(`Preview not supported for ${file.name}`);
    }
  }, []);

  const handleKeepOffline = useCallback(async (file: TelegramFile) => {
    const toastId = toast.loading(`Saving ${file.name} for offline use…`);
    const folderId = file.folder_id ?? activeFolderId;
    try {
      await invoke('cmd_get_preview', { messageId: file.id, folderId });
      await invoke('cmd_set_preview_pinned', { messageId: file.id, folderId, pinned: true });
      await Promise.all([refetchOfflineCache(), queryClient.invalidateQueries({ queryKey: ['files', activeFolderId] })]);
      toast.success(`${file.name} will be kept offline`, { id: toastId });
    } catch (error) {
      toast.error(`Could not keep this file offline: ${error}`, { id: toastId });
    }
  }, [activeFolderId, queryClient, refetchOfflineCache]);

  const handleRemoveOffline = useCallback(async (file: TelegramFile) => {
    const folderId = file.folder_id ?? activeFolderId;
    try {
      await invoke('cmd_set_preview_pinned', { messageId: file.id, folderId, pinned: false });
      await invoke('cmd_delete_preview_for_message', { messageId: file.id, folderId });
      await Promise.all([refetchOfflineCache(), queryClient.invalidateQueries({ queryKey: ['files', activeFolderId] })]);
      toast.success(`Removed the offline copy of ${file.name}`);
    } catch (error) {
      toast.error(`Could not remove the offline copy: ${error}`);
    }
  }, [activeFolderId, queryClient, refetchOfflineCache]);

  const handleRenameFile = useCallback((file: TelegramFile) => {
    const currentName = fileRenames.get(file.id) || file.name;
    const newName = prompt(`Rename "${currentName}":`, currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;
    setFileRenames(prev => {
      const next = new Map(prev);
      next.set(file.id, newName.trim());
      return next;
    });
    toast.success(`Renamed to "${newName.trim()}"`);
  }, [fileRenames]);

  // Bulk share: generate links for all selected non-folder files
  const handleBulkShare = useCallback(async () => {
    const shareFiles = allFiles.filter(f => selectedIds.includes(f.id) && f.type !== 'folder');
    if (shareFiles.length === 0) {
      toast.info('No shareable files selected (folders cannot be shared)');
      return;
    }
    // Open modal immediately with spinner
    setBulkShareLinks([]);
    setBulkShareLoading(true);
    setBulkShareCopied(new Set());
    try {
      const results = await Promise.all(
        shareFiles.map(async (file) => {
          try {
            const info = await invoke<ShareInfo>('cmd_create_share', {
              folderId: null,
              messageId: file.id,
              fileName: file.name,
              fileSize: file.size,
              password: null,
              expiryHours: 24, // default 1 day
            });
            return { file, link: info.link };
          } catch (e) {
            toast.error(`Failed to share ${file.name}: ${e}`);
            return null;
          }
        })
      );
      const valid = results.filter((r): r is { file: TelegramFile; link: string } => r !== null);
      if (valid.length > 0) {
        setBulkShareLinks(valid);
        setSelectedIds([]); // Clear selection after successful bulk share
      } else {
        setBulkShareLinks(null);
        toast.error('Failed to generate any share links');
      }
    } finally {
      setBulkShareLoading(false);
    }
  }, [allFiles, selectedIds]);

  const handleCopyBulkLink = useCallback((link: string) => {
    navigator.clipboard.writeText(link);
    setBulkShareCopied(prev => new Set(prev).add(link));
    setTimeout(() => setBulkShareCopied(prev => {
      const next = new Set(prev);
      next.delete(link);
      return next;
    }), 2000);
  }, []);

  const handleNativeShareBulkLink = useCallback((file: TelegramFile, link: string) => {
    nativeShareOrCopy(file.name, file.sizeStr, link, () => {
      handleCopyBulkLink(link);
    });
  }, [handleCopyBulkLink]);

  // ── Copy Telegram native t.me link ────────────────────────────────────
  const handleCopyTelegramLink = useCallback((file: TelegramFile) => {
    const folder = folders.find(f => f.id === file.folder_id) || folders.find(f => f.id === activeFolderId);
    const username = folder?.username || (folder as any)?.chat?.username || (folder as any)?.channel?.username;
    if (!username) {
      toast.error('Only available for public channels');
      return;
    }
    const url = `https://t.me/${username}/${file.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Telegram link copied');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  }, [folders, activeFolderId]);

  const renamedFiles = useMemo(() => {
    if (fileRenames.size === 0) return allFiles;
    return allFiles.map(f =>
      fileRenames.has(f.id) ? { ...f, name: fileRenames.get(f.id)! } : f
    );
  }, [allFiles, fileRenames]);

  const { query, setQuery, filters, setFilters, results, reset: resetSearch } = useMobileFileSearch(renamedFiles, activeFolderId);

  // Same ordering and the same persisted setting as the desktop explorer, so a
  // folder reads identically on both.
  const displayFiles = useMemo(
    () => sortFiles(results, settings.fileSortField, settings.fileSortDirection, settings.language),
    [results, settings.fileSortField, settings.fileSortDirection, settings.language],
  );
  const hasSearchCriteria = query.trim().length > 0 || filters.type !== 'all' || filters.size !== 'any' || filters.date !== 'any';
  useEffect(() => setSelectedIds([]), [activeFolderId, query, filters.type, filters.size, filters.date]);
  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === displayFiles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayFiles.map(f => f.id));
    }
  }, [displayFiles, selectedIds.length]);
  const cycleSort = useCallback((field: SortField) => {
    const next = nextSortState(
      { field: settings.fileSortField, direction: settings.fileSortDirection },
      field,
    );
    updateSettings({ fileSortField: next.field, fileSortDirection: next.direction });
    setShowSortMenu(false);
  }, [settings.fileSortField, settings.fileSortDirection, updateSettings]);

  // Swiping through the image viewer walks the images of the current list in
  // display order. Videos and documents open different full-screen surfaces,
  // so they stay out of the sequence rather than yanking the user between them.
  const previewImages = useMemo(
    () => displayFiles.filter(f => f.type !== 'folder' && isImageFile(f.name, f.mime_type)),
    [displayFiles],
  );
  const previewIndex = previewFile
    ? previewImages.findIndex(f => f.id === previewFile.id)
    : -1;
  const stepPreview = useCallback((step: 1 | -1) => {
    if (previewIndex < 0 || previewImages.length < 2) return;
    const next = previewImages[(previewIndex + step + previewImages.length) % previewImages.length];
    if (next) setPreviewFile(next);
  }, [previewIndex, previewImages]);

  useEffect(() => showSortMenu ? registerBackHandler('sort-menu', 100, () => setShowSortMenu(false)) : undefined, [registerBackHandler, showSortMenu]);
  useEffect(() => supporterOfferTrigger ? registerBackHandler('supporter-offer', 300, () => setSupporterOfferTrigger(null)) : undefined, [registerBackHandler, supporterOfferTrigger]);
  useEffect(() => playingFile ? registerBackHandler('media-player', 290, () => setPlayingFile(null)) : undefined, [playingFile, registerBackHandler]);
  useEffect(() => pdfFile ? registerBackHandler('pdf-viewer', 280, () => setPdfFile(null)) : undefined, [pdfFile, registerBackHandler]);
  useEffect(() => previewFile ? registerBackHandler('preview', 270, () => setPreviewFile(null)) : undefined, [previewFile, registerBackHandler]);
  useEffect(() => shareFile ? registerBackHandler('share-file', 260, () => setShareFile(null)) : undefined, [registerBackHandler, shareFile]);
  useEffect(() => bulkShareLinks ? registerBackHandler('bulk-share-links', 250, () => setBulkShareLinks(null)) : undefined, [bulkShareLinks, registerBackHandler]);
  useEffect(() => showHelp ? registerBackHandler('help', 240, () => setShowHelp(false)) : undefined, [registerBackHandler, showHelp]);
  useEffect(() => settingsLoaded && !settings.driveTourSeen ? registerBackHandler('drive-tour', 230, () => updateSetting('driveTourSeen', true)) : undefined, [registerBackHandler, settings.driveTourSeen, settingsLoaded, updateSetting]);
  useEffect(() => selectedIds.length > 0 ? registerBackHandler('selection', 20, () => setSelectedIds([])) : undefined, [registerBackHandler, selectedIds.length]);
  useEffect(() => activeTab !== 'files' ? registerBackHandler('tab-navigation', 11, () => setActiveTab('files')) : undefined, [activeTab, registerBackHandler]);
  useEffect(() => activeFolderId !== null ? registerBackHandler('folder-navigation', 10, () => setActiveFolderId(null)) : undefined, [activeFolderId, registerBackHandler, setActiveFolderId]);

  return (
    <div className={`absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden bg-telegram-bg text-telegram-text select-none font-sans ${isTelevision ? 'tv-shell' : ''}`}>
      <MobileDashboardHeader activeTab={activeTab} title={t('common.app_title')} onOpenFolders={() => setIsSidebarOpen(true)}>
        <MobileFileDisplayControls
          settings={settings} showSortMenu={showSortMenu}
          onToggleSort={() => setShowSortMenu(open => !open)} onCloseSort={() => setShowSortMenu(false)}
          onSort={cycleSort} onToggleLayout={() => updateSetting('viewMode', settings.viewMode === 'grid' ? 'list' : 'grid')}
        />
      </MobileDashboardHeader>

      {/* Main Viewport Container */}
      <main ref={scrollRootRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto space-y-4 px-4 py-3 scroll-smooth md:ml-[280px] md:px-8 lg:px-12">
        {activeTab === 'files' && (
          <div className="space-y-4">
            <MobileFolderToolbar activeFolder={activeFolder} handleManualUpload={handleManualUpload} handleSyncFolders={handleSyncFolders} isSyncing={isSyncing} />
            <MobileFileSearchToolbar
              query={query}
              onQueryChange={setQuery}
              filters={filters}
              onFiltersChange={setFilters}
              onReset={resetSearch}
              resultCount={displayFiles.length}
              isLoading={isFetching}
              registerBackHandler={registerBackHandler}
            />

            {continueWatching.length > 0 && (
              <section className="rounded-2xl border border-telegram-border/30 bg-telegram-hover/20 p-3" aria-labelledby="continue-watching-title">
                <h2 id="continue-watching-title" className="mb-2 text-[10px] font-bold uppercase tracking-wide text-telegram-primary">Continue watching</h2>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {continueWatching.map(({ entry, file, progress }) => (
                    <button key={entry.mediaId} type="button" onClick={() => setPlayingFile(file)} className="w-44 shrink-0 rounded-xl border border-telegram-border/30 bg-telegram-bg/50 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-telegram-primary">
                      <span className="block truncate text-xs font-semibold text-telegram-text">{settings.androidPrivateMediaMetadata ? file.name : entry.title}</span>
                      <span className="mt-1 block text-[10px] text-telegram-subtext">Resume at {Math.floor(entry.positionMs / 60_000)}:{String(Math.floor(entry.positionMs / 1000) % 60).padStart(2, '0')}</span>
                      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-telegram-border/40"><span className="block h-full rounded-full bg-telegram-primary" style={{ width: `${progress}%` }} /></span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Dynamic Real File List */}
            <TouchFileList
              viewMode={settings.viewMode}
              files={displayFiles}
              isLoading={isLoading && allFiles.length === 0}
              isFilteredEmpty={hasSearchCriteria && allFiles.length > 0}
              onDownload={handleDownload}
              onDelete={handleDeleteFile}
              onPreview={handlePreview}
              onRename={handleRenameFile}
              onShare={setShareFile}
              onCopyTelegramLink={handleCopyTelegramLink}
              onKeepOffline={handleKeepOffline}
              onRemoveOffline={handleRemoveOffline}
              onBulkShare={handleBulkShare}
              selectedIds={selectedIds}
              onToggleSelection={handleToggleSelection}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              onBulkDelete={handleBulkDelete}
              onBulkDownload={handleBulkDownload}
              onBulkMove={handleBulkMove}
              folders={folders}
              activeFolderId={activeFolderId}
              scrollElementRef={scrollRootRef}
              disableVirtualization={isTelevision}
              registerBackHandler={registerBackHandler}
            />
          </div>
        )}

        {activeTab === 'downloads' && (
          <MobileTransfersPanel
            uploadQueue={uploadQueue}
            downloadQueue={downloadQueue}
            activeUploadCount={activeUploadCount}
            activeDownloadCount={activeDownloadCount}
            pausedUploadCount={pausedUploadCount}
            pausedDownloadCount={pausedDownloadCount}
            networkWaitingCount={networkWaitingCount}
            aggregateTransferSpeed={aggregateTransferSpeed}
            pauseUploads={pauseUploads}
            resumeUploads={resumeUploads}
            cancelUploads={cancelUploads}
            clearUploads={clearUploads}
            cancelUpload={cancelUpload}
            retryUpload={retryUpload}
            pauseDownloads={pauseDownloads}
            resumeDownloads={resumeDownloads}
            cancelDownloads={cancelDownloads}
            clearDownloads={clearDownloads}
            cancelDownload={cancelDownload}
            retryDownload={retryDownload}
          />
        )}

        {activeTab === 'settings' && (
          <MobileSettingsPanel
            settings={settings}
            updateSetting={updateSetting}
            supporterStatus={supporterStatus}
            openMobileSupporter={openMobileSupporter}
            isConnected={isConnected}
            isAndroid={isAndroid}
            transferAllowed={transferAllowed}
            transferWaitingReason={transferWaitingReason}
            androidTransferEnvironment={androidTransferEnvironment}
            bandwidth={bandwidth}
            diagnostics={diagnostics}
            cachedFiles={cachedFiles}
            uploadingCacheFiles={uploadingCacheFiles}
            handleUploadCachedFile={handleUploadCachedFile}
            handleClearCachedFiles={handleClearCachedFiles}
            setShowHelp={setShowHelp}
            handleLogout={handleLogout}
          />
        )}
      </main>

      <MobileFolderDrawer
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeFolderId={activeFolderId}
        setActiveFolderId={setActiveFolderId}
        folders={folders}
        setFolderActionMenu={setFolderActionMenu}
        folderActionMenu={folderActionMenu}
        buildFolderActions={buildFolderActions}
        renameFolder={renameFolder}
        setRenameFolder={setRenameFolder}
        handleFolderRename={handleFolderRename}
        handleCreateFolder={handleCreateFolder}
        bandwidth={bandwidth}
        isConnected={isConnected}
        registerBackHandler={registerBackHandler}
      />

      {isTelevision ? (
        <>
          <BottomNavBar activeTab={activeTab} setActiveTab={setActiveTab} isAndroid={isAndroid} isTelevision />
          <div className="fixed bottom-[144px] left-0 right-0 z-[60] tv-sponsor-placement">
            <AdsterraBanner
              visible={adVisible}
              onSupport={openMobileSupporter}
              onManualDismiss={() => showSupporterOffer('ad_dismissed')}
            />
          </div>
        </>
      ) : (
        <footer className="shrink-0 pb-[env(safe-area-inset-bottom)] md:ml-[280px]">
          <AdsterraBanner
            visible={adVisible}
            onSupport={openMobileSupporter}
            onManualDismiss={() => showSupporterOffer('ad_dismissed')}
          />
          <BottomNavBar activeTab={activeTab} setActiveTab={setActiveTab} isAndroid={isAndroid} isTelevision={isTelevision} embedded />
        </footer>
      )}

      <MobileDashboardOverlays
        playingFile={playingFile}
        setPlayingFile={setPlayingFile}
        pdfFile={pdfFile}
        setPdfFile={setPdfFile}
        previewFile={previewFile}
        setPreviewFile={setPreviewFile}
        shareFile={shareFile}
        setShareFile={setShareFile}
        activeFolderId={activeFolderId}
        settings={settings}
        settingsLoaded={settingsLoaded}
        updateSetting={updateSetting}
        handleDownload={handleDownload}
        previewImages={previewImages}
        previewIndex={previewIndex}
        stepPreview={stepPreview}
        folders={folders}
        showHelp={showHelp}
        setShowHelp={setShowHelp}
        supporterOfferTrigger={supporterOfferTrigger}
        setSupporterOfferTrigger={setSupporterOfferTrigger}
        isTelevision={isTelevision}
        openMobileSupporter={openMobileSupporter}
        bulkShareLinks={bulkShareLinks}
        setBulkShareLinks={setBulkShareLinks}
        bulkShareLoading={bulkShareLoading}
        bulkShareCopied={bulkShareCopied}
        handleCopyBulkLink={handleCopyBulkLink}
        handleNativeShareBulkLink={handleNativeShareBulkLink}
      />
    </div>
  );
}
