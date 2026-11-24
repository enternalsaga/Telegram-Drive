import { CheckCircle2, UploadCloud, Download, Pause, Play, X, RotateCcw } from 'lucide-react';
import type { QueueItem, DownloadItem } from '../../types/transfers';
import { formatBytes } from '../../utils';
import i18n from '../../i18n';

interface MobileTransfersPanelProps {
  uploadQueue: QueueItem[];
  downloadQueue: DownloadItem[];
  activeUploadCount: number;
  activeDownloadCount: number;
  pausedUploadCount: number;
  pausedDownloadCount: number;
  networkWaitingCount: number;
  aggregateTransferSpeed: number;
  pauseUploads: () => void;
  resumeUploads: () => void;
  cancelUploads: () => void;
  clearUploads: () => void;
  cancelUpload: (id: string) => void;
  retryUpload: (id: string) => Promise<void>;
  pauseDownloads: () => void;
  resumeDownloads: () => void;
  cancelDownloads: () => void;
  clearDownloads: () => void;
  cancelDownload: (id: string) => void;
  retryDownload: (id: string) => Promise<void>;
}

export function MobileTransfersPanel({ uploadQueue, downloadQueue, activeUploadCount, activeDownloadCount, pausedUploadCount, pausedDownloadCount, networkWaitingCount, aggregateTransferSpeed, pauseUploads, resumeUploads, cancelUploads, clearUploads, cancelUpload, retryUpload, pauseDownloads, resumeDownloads, cancelDownloads, clearDownloads, cancelDownload, retryDownload }: MobileTransfersPanelProps) {
  return (
    <div className="space-y-4" aria-label="Transfer queue">
      <div className="rounded-2xl border border-telegram-border/30 bg-telegram-hover/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-telegram-text">Transfers</h2>
            <p className="mt-0.5 text-[10px] text-telegram-subtext">
              {activeUploadCount + activeDownloadCount > 0
                ? `${activeUploadCount + activeDownloadCount} active${aggregateTransferSpeed > 0 ? ` · ${formatBytes(aggregateTransferSpeed)}/s` : ''}`
                : networkWaitingCount > 0
                  ? `${networkWaitingCount} waiting for network`
                : pausedUploadCount + pausedDownloadCount > 0
                  ? `${pausedUploadCount + pausedDownloadCount} paused`
                  : 'Queue is up to date'}
            </p>
          </div>
          {uploadQueue.length + downloadQueue.length > 0 && activeUploadCount + activeDownloadCount === 0 && pausedUploadCount + pausedDownloadCount === 0 && (
            <CheckCircle2 className="h-6 w-6 text-emerald-400" aria-hidden="true" />
          )}
        </div>
      </div>

      {([
        {
          title: 'Uploads', icon: UploadCloud, items: uploadQueue,
          active: activeUploadCount, paused: pausedUploadCount,
          pause: pauseUploads, resume: resumeUploads, cancelAll: cancelUploads,
          clear: clearUploads,
          cancel: cancelUpload, retry: retryUpload,
        },
        {
          title: 'Downloads', icon: Download, items: downloadQueue,
          active: activeDownloadCount, paused: pausedDownloadCount,
          pause: pauseDownloads, resume: resumeDownloads, cancelAll: cancelDownloads,
          clear: clearDownloads, cancel: cancelDownload, retry: retryDownload,
        },
      ] as const).map(section => (
        <section key={section.title} className="overflow-hidden rounded-2xl border border-telegram-border/30 bg-telegram-hover/20">
          <header className="flex items-center justify-between gap-3 border-b border-telegram-border/20 px-4 py-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-telegram-text"><section.icon className="h-4 w-4 text-telegram-primary" aria-hidden="true" />{section.title}</h3>
            <div className="flex items-center gap-2 text-[10px] font-semibold">
              {section.active > 0 && <button type="button" onClick={section.pause} className="flex items-center gap-1 text-telegram-subtext"><Pause className="h-3 w-3" aria-hidden="true" />Pause</button>}
              {section.paused > 0 && <button type="button" onClick={section.resume} className="flex items-center gap-1 text-telegram-primary"><Play className="h-3 w-3" aria-hidden="true" />Resume</button>}
              {section.active > 0 && <button type="button" onClick={section.cancelAll} className="text-red-400">{i18n.t("common.cancel")}</button>}
              <button type="button" onClick={section.clear} className="text-telegram-primary">Clear</button>
            </div>
          </header>
          {section.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[11px] text-telegram-subtext">No {section.title.toLowerCase()} yet.</p>
          ) : section.items.map(item => {
            const name = 'filename' in item ? item.filename : (item.url || item.path).split(/[\\/]/).pop() || item.path;
            const canCancel = ['pending', 'paused', 'waiting_for_network', 'waiting_for_unlock', 'error', 'cooldown', 'uploading', 'downloading', 'encrypting', 'decrypting', 'verifying'].includes(item.status);
            const canRetry = ['error', 'cancelled', 'waiting_for_unlock'].includes(item.status);
            return (
              <div key={item.id} className="border-t border-telegram-border/20 px-4 py-3 first:border-t-0">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-telegram-text">{name}</p><p className="mt-0.5 text-[10px] capitalize text-telegram-subtext">{item.status.replace(/_/g, ' ')}{item.speedBytesPerSec ? ` · ${formatBytes(item.speedBytesPerSec)}/s` : ''}</p></div>
                  {canCancel && <button type="button" onClick={() => section.cancel(item.id)} className="rounded-lg p-2 text-telegram-subtext" aria-label={`Cancel ${name}`}><X className="h-4 w-4" aria-hidden="true" /></button>}
                  {canRetry && <button type="button" onClick={() => void section.retry(item.id)} className="rounded-lg p-2 text-telegram-primary" aria-label={`Retry ${name}`}><RotateCcw className="h-4 w-4" aria-hidden="true" /></button>}
                </div>
                {['uploading', 'downloading', 'encrypting', 'decrypting', 'verifying'].includes(item.status) && <div className="mt-2 h-1 overflow-hidden rounded-full bg-telegram-border/30"><div className="h-full rounded-full bg-telegram-primary transition-[width] motion-reduce:transition-none" style={{ width: `${item.progress || 2}%` }} /></div>}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
