import { Folder, UploadCloud, RefreshCw } from 'lucide-react';
import i18n from '../../i18n';

interface MobileFolderToolbarProps {
  activeFolder: string;
  handleManualUpload: () => void;
  handleSyncFolders: () => void;
  isSyncing: boolean;
}

export function MobileFolderToolbar({ activeFolder, handleManualUpload, handleSyncFolders, isSyncing }: MobileFolderToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-telegram-border/30 bg-telegram-hover/20 p-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Folder className="h-5 w-5 shrink-0 text-telegram-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{activeFolder}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleManualUpload}
          className="flex min-h-11 items-center gap-1.5 rounded-xl border border-telegram-primary/10 bg-telegram-primary px-3 py-1.5 text-xs font-semibold text-black transition-all duration-200 hover:bg-telegram-primary/95 active:scale-95"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          {i18n.t("common.upload")}
        </button>
        <button
          onClick={handleSyncFolders}
          disabled={isSyncing}
          className="flex min-h-11 items-center gap-1.5 rounded-xl border border-telegram-primary/10 bg-telegram-primary/15 px-3 py-1.5 text-xs font-semibold text-telegram-primary transition-all duration-200 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {i18n.t("common.sync")}
        </button>
      </div>
    </div>
  );
}
