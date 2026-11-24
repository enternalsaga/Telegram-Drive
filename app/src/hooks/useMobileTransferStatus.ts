import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { QueueItem, DownloadItem } from '../types/transfers';

interface MobileTransferStatusOptions {
  isAndroid: boolean;
  settingsLoaded: boolean;
  uploadQueue: QueueItem[];
  downloadQueue: DownloadItem[];
  pauseUploads: () => void;
  pauseDownloads: () => void;
  resumeUploads: () => void;
  resumeDownloads: () => void;
  cancelUploads: () => void;
  cancelDownloads: () => void;
}

export function useMobileTransferStatus({ isAndroid, settingsLoaded, uploadQueue, downloadQueue, pauseUploads, pauseDownloads, resumeUploads, resumeDownloads, cancelUploads, cancelDownloads }: MobileTransferStatusOptions) {
  const transferServiceRunningRef = useRef(false);
  const transferNotificationTimerRef = useRef<number | null>(null);
  const transferNotificationStateRef = useRef({ active: 0, progress: 0, speed: 0, paused: false });

  const activeUploadCount = uploadQueue.filter(item => ['pending', 'uploading', 'downloading', 'encrypting', 'verifying'].includes(item.status)).length;
  const activeDownloadCount = downloadQueue.filter(item => ['pending', 'cooldown', 'downloading', 'decrypting', 'verifying'].includes(item.status)).length;
  const pausedUploadCount = uploadQueue.filter(item => item.status === 'paused').length;
  const pausedDownloadCount = downloadQueue.filter(item => item.status === 'paused').length;
  const networkWaitingCount = [...uploadQueue, ...downloadQueue].filter(item => item.status === 'waiting_for_network').length;
  const aggregateTransferSpeed = [...uploadQueue, ...downloadQueue].reduce((sum, item) => sum + (item.speedBytesPerSec || 0), 0);
  const foregroundItems = [...uploadQueue, ...downloadQueue].filter(item =>
    ['pending', 'uploading', 'downloading', 'encrypting', 'decrypting', 'verifying'].includes(item.status)
  );
  const aggregateTransferProgress = foregroundItems.length > 0
    ? Math.round(foregroundItems.reduce((sum, item) => sum + (item.progress || 0), 0) / foregroundItems.length)
    : 0;

  useEffect(() => {
    if (!isAndroid) return;
    const hasRunningTransfers = [...uploadQueue, ...downloadQueue]
      .some(item => ['pending', 'uploading', 'downloading', 'encrypting', 'decrypting', 'verifying'].includes(item.status));
    if (hasRunningTransfers && !transferServiceRunningRef.current) {
      transferServiceRunningRef.current = true;
      void invoke('cmd_start_foreground_service').catch(() => {
        transferServiceRunningRef.current = false;
      });
    } else if (!hasRunningTransfers && settingsLoaded && transferServiceRunningRef.current) {
      transferServiceRunningRef.current = false;
      void invoke('cmd_stop_foreground_service').catch(() => undefined);
    }
  }, [downloadQueue, isAndroid, settingsLoaded, uploadQueue]);

  useEffect(() => {
    if (!isAndroid || !transferServiceRunningRef.current) return;
    transferNotificationStateRef.current = {
      active: foregroundItems.length,
      progress: aggregateTransferProgress,
      speed: Math.round(aggregateTransferSpeed),
      paused: foregroundItems.length === 0 && pausedUploadCount + pausedDownloadCount > 0,
    };
    if (transferNotificationTimerRef.current !== null) return;
    transferNotificationTimerRef.current = window.setTimeout(() => {
      transferNotificationTimerRef.current = null;
      void invoke('cmd_update_foreground_service', transferNotificationStateRef.current).catch(() => undefined);
    }, 750);
  }, [aggregateTransferProgress, aggregateTransferSpeed, foregroundItems.length, isAndroid, pausedDownloadCount, pausedUploadCount]);

  useEffect(() => () => {
    if (transferNotificationTimerRef.current !== null) {
      window.clearTimeout(transferNotificationTimerRef.current);
      transferNotificationTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isAndroid) return;
    const applyTransferAction = (action: string) => {
      if (action === 'pause' || action === 'timeout') {
        pauseUploads();
        pauseDownloads();
        if (action === 'timeout') toast.info('Android paused long-running transfers. Open Transfers to resume.');
      } else if (action === 'resume') {
        resumeUploads();
        resumeDownloads();
      } else if (action === 'cancel') {
        cancelUploads();
        cancelDownloads();
      }
    };
    const handleTransferAction = (event: Event) => applyTransferAction((event as CustomEvent<string>).detail);
    window.addEventListener('android-transfer-action', handleTransferAction);
    void invoke<string>('cmd_get_pending_android_transfer_action')
      .then(action => { if (action) applyTransferAction(action); })
      .catch(() => undefined);
    return () => window.removeEventListener('android-transfer-action', handleTransferAction);
  }, [cancelDownloads, cancelUploads, isAndroid, pauseDownloads, pauseUploads, resumeDownloads, resumeUploads]);

  useEffect(() => () => {
    if (isAndroid && transferServiceRunningRef.current) {
      transferServiceRunningRef.current = false;
      void invoke('cmd_stop_foreground_service').catch(() => undefined);
    }
  }, [isAndroid]);

  return { activeUploadCount, activeDownloadCount, pausedUploadCount, pausedDownloadCount,
    networkWaitingCount, aggregateTransferSpeed };
}
