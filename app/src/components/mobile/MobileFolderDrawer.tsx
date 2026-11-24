import { useEffect, useState } from 'react';
import { Globe, Lock, MoreVertical } from 'lucide-react';
import type { TelegramFolder, BandwidthStats } from '../../types';
import { BandwidthWidget } from '../desktop/dashboard/BandwidthWidget';
import { ActionPopover, type ActionItem } from './ActionPopover';
import { RenameFolderSheet } from './RenameFolderSheet';
import i18n from '../../i18n';
import { MobileBottomSheet } from './MobileBottomSheet';
import { type RegisterMobileBackHandler } from '../../hooks/useMobileBackHandlers';

interface MobileFolderDrawerProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  activeFolderId: number | null;
  setActiveFolderId: (id: number | null) => void;
  folders: TelegramFolder[];
  setFolderActionMenu: (folder: TelegramFolder | null) => void;
  folderActionMenu: TelegramFolder | null;
  buildFolderActions: (folder: TelegramFolder) => ActionItem[];
  renameFolder: { id: number; name: string } | null;
  setRenameFolder: (folder: { id: number; name: string } | null) => void;
  handleFolderRename: (folderId: number, oldName: string, newNameOverride?: string) => Promise<void>;
  handleCreateFolder: (name: string) => Promise<void>;
  bandwidth: BandwidthStats | undefined;
  isConnected: boolean;
  registerBackHandler?: RegisterMobileBackHandler;
}

export function MobileFolderDrawer({ isSidebarOpen, setIsSidebarOpen, activeFolderId, setActiveFolderId, folders, setFolderActionMenu, folderActionMenu, buildFolderActions, renameFolder, setRenameFolder, handleFolderRename, handleCreateFolder, bandwidth, isConnected, registerBackHandler }: MobileFolderDrawerProps) {
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  useEffect(() => isSidebarOpen ? registerBackHandler?.('folder-drawer', 10, () => setIsSidebarOpen(false)) : undefined, [isSidebarOpen, registerBackHandler, setIsSidebarOpen]);

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name || isCreatingFolder) return;
    setIsCreatingFolder(true);
    try {
      await handleCreateFolder(name);
      setNewFolderName('');
      setShowCreateFolder(false);
    } catch {
      // The connection hook reports the error. Keeping this value enables a retry.
    } finally {
      setIsCreatingFolder(false);
    }
  };

  return (
    <>
      {/* Slide-out Sidebar Drawer Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm transition-opacity duration-300 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Slide-out Sidebar Drawer Panel */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-[280px] bg-telegram-surface border-r border-telegram-border/60 z-[110] shadow-2xl flex flex-col pt-[calc(1rem+env(safe-area-inset-top,24px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] transition-transform duration-300 ease-out transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 flex items-center justify-between border-b border-telegram-border/30">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" className="w-8 h-8 drop-shadow-lg" alt="Logo" />
            <span className="font-bold text-base text-telegram-text tracking-tight">{i18n.t("common.app_title")}</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="min-h-11 min-w-11 p-1 rounded-lg bg-telegram-hover/30 hover:bg-telegram-hover/60 text-telegram-subtext text-xs md:hidden"
            aria-label="Close folders"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Folder List */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto min-h-0">
          <button
            onClick={() => {
              setActiveFolderId(null);
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${activeFolderId === null
                ? 'bg-telegram-primary/15 text-telegram-primary border border-telegram-primary/15'
                : 'text-telegram-subtext hover:bg-telegram-hover/40 hover:text-telegram-text border border-transparent'
              }`}
          >
            <span>{i18n.t("common.saved_messages")}</span>
          </button>

          {folders.map(folder => {
            const isPublic = folder.is_public || !!folder.username;
            return (
            <div key={folder.id} className="flex items-center gap-1">
              <button
                onClick={() => {
                  setActiveFolderId(folder.id);
                  setIsSidebarOpen(false);
                }}
                className={`flex-1 text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeFolderId === folder.id
                    ? 'bg-telegram-primary/15 text-telegram-primary border border-telegram-primary/15'
                    : 'text-telegram-subtext hover:bg-telegram-hover/40 hover:text-telegram-text border border-transparent'
                }`}
              >
                <span className="flex items-center gap-1.5 max-w-[150px]">
                  <span className="truncate">{folder.name}</span>
                  {isPublic ? (
                    <Globe className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Lock className="w-3 h-3 text-amber-400/60 flex-shrink-0" />
                  )}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFolderActionMenu(folder);
                }}
                className="flex-shrink-0 p-2 rounded-xl hover:bg-telegram-hover/40 active:bg-telegram-hover/60 text-telegram-subtext/60 hover:text-telegram-subtext transition-all duration-200"
                aria-label="Folder actions"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
            );
          })}
        </nav>

        {/* Action Panel & Connection Status */}
        <div className="px-4 py-3 border-t border-telegram-border/30 space-y-3">
          <BandwidthWidget bandwidth={bandwidth ?? null} />
          <button
            onClick={() => setShowCreateFolder(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-telegram-subtext hover:text-telegram-text border border-dashed border-telegram-border/60 hover:bg-telegram-hover/20 transition-all duration-200"
          >
            + {i18n.t('common.create_folder')}
          </button>
          <div className="flex items-center gap-2 text-telegram-subtext text-[10px] font-semibold uppercase tracking-wider">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span>{isConnected ? 'Connected' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* Folder action popover (replaces swipe-to-reveal) */}
      {folderActionMenu && (
        <ActionPopover
          title={folderActionMenu.name}
          actions={buildFolderActions(folderActionMenu)}
          onClose={() => setFolderActionMenu(null)}
          registerBackHandler={registerBackHandler}
          backHandlerId="folder-action-menu"
        />
      )}

      {/* Rename folder bottom sheet */}
      {renameFolder && (
        <RenameFolderSheet
          folderId={renameFolder.id}
          currentName={renameFolder.name}
          onRename={handleFolderRename}
          onClose={() => setRenameFolder(null)}
          registerBackHandler={registerBackHandler}
        />
      )}

      {showCreateFolder && (
        <MobileBottomSheet title={i18n.t('common.create_folder')} onClose={() => setShowCreateFolder(false)}>
          <CreateFolderBackRegistration registerBackHandler={registerBackHandler} onClose={() => setShowCreateFolder(false)} />
          <input
            type="text"
            data-modal-autofocus
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void createFolder();
              }
            }}
            maxLength={100}
            disabled={isCreatingFolder}
            placeholder={i18n.t('files.folder_name')}
            className="mb-4 w-full rounded-xl border border-telegram-border bg-telegram-bg px-3.5 py-3 text-sm text-telegram-text placeholder:text-telegram-subtext/50 focus:border-telegram-primary/50 focus:outline-none focus:ring-2 focus:ring-telegram-primary/50"
          />
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowCreateFolder(false)} disabled={isCreatingFolder} className="flex-1 rounded-xl bg-telegram-hover/30 py-3 text-sm font-semibold text-telegram-subtext disabled:opacity-40">
              {i18n.t('common.cancel')}
            </button>
            <button type="button" onClick={() => void createFolder()} disabled={isCreatingFolder || !newFolderName.trim()} className="flex-1 rounded-xl bg-telegram-primary py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {i18n.t('common.create_folder')}
            </button>
          </div>
        </MobileBottomSheet>
      )}

    </>
  );
}

function CreateFolderBackRegistration({ registerBackHandler, onClose }: { registerBackHandler?: RegisterMobileBackHandler; onClose: () => void }) {
  useEffect(() => registerBackHandler?.('create-folder', 120, onClose), [onClose, registerBackHandler]);
  return null;
}
