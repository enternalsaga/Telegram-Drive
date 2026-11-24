import type { ReactNode } from 'react';
import { Menu, ArrowUpDown, ArrowUp, ArrowDown, List, LayoutGrid } from 'lucide-react';
import type { Settings } from '../../types/settings';
import type { SortField } from '../../services/fileSort';
import i18n from '../../i18n';

interface MobileDashboardHeaderProps {
  activeTab: 'files' | 'downloads' | 'settings';
  title: string;
  onOpenFolders: () => void;
  children?: ReactNode;
}

export function MobileDashboardHeader({ activeTab, title, onOpenFolders, children }: MobileDashboardHeaderProps) {
  return (
    <header className="shrink-0 min-w-0 border-b border-telegram-border/60 bg-gradient-to-r from-telegram-hover/40 to-telegram-bg px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top,24px))] shadow-lg backdrop-blur-md z-40 md:ml-[280px]">
      <div className="flex min-w-0 items-center gap-2">
        <button onClick={onOpenFolders} className="min-h-11 min-w-11 shrink-0 rounded-xl border border-telegram-border/40 bg-telegram-hover/30 p-2 text-telegram-subtext transition-all duration-300 hover:bg-telegram-hover/60 md:hidden" aria-label="Open folders">
          <Menu className="mx-auto h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <img src="/logo.svg" className="h-8 w-8 shrink-0 drop-shadow-lg" alt="Logo" />
          <h1 className="min-w-0 truncate text-base font-bold tracking-tight text-telegram-text">{title}</h1>
        </div>
      </div>
      {activeTab === 'files' && children}
    </header>
  );
}



interface MobileFileDisplayControlsProps {
  settings: Pick<Settings, 'fileSortField' | 'fileSortDirection' | 'viewMode'>;
  showSortMenu: boolean;
  onToggleSort: () => void;
  onCloseSort: () => void;
  onSort: (field: SortField) => void;
  onToggleLayout: () => void;
}

export function MobileFileDisplayControls({ settings, showSortMenu, onToggleSort, onCloseSort, onSort, onToggleLayout }: MobileFileDisplayControlsProps) {
  return (
    <div className="mt-3 flex min-w-0 items-center justify-end gap-2">
      <div className="relative">
        <button
          onClick={() => onToggleSort()}
          className="min-h-12 min-w-12 p-2 rounded-xl bg-telegram-hover/30 hover:bg-telegram-hover/60 border border-telegram-border/40 text-telegram-subtext transition-all duration-300"
          aria-label={i18n.t('common.sort_by')}
          aria-expanded={showSortMenu}
          title={i18n.t('common.sort_by')}
        >
          <ArrowUpDown className="mx-auto w-5 h-5" aria-hidden="true" />
        </button>
        {showSortMenu && (
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => onCloseSort()} aria-hidden="true" />
            <div className="absolute end-0 top-full z-[95] mt-1 w-40 overflow-hidden rounded-xl border border-telegram-border/50 bg-telegram-surface shadow-2xl">
              {([
                ['name', i18n.t('common.name')],
                ['size', i18n.t('common.size')],
                ['date', i18n.t('common.date')],
              ] as [SortField, string][]).map(([field, label]) => {
                const active = settings.fileSortField === field;
                return (
                  <button
                    key={field}
                    onClick={() => onSort(field)}
                    className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold transition-colors ${
                      active ? 'bg-telegram-primary/10 text-telegram-primary' : 'text-telegram-subtext hover:bg-white/5'
                    }`}
                  >
                    {label}
                    {active && (settings.fileSortDirection === 'asc'
                      ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />)}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <button
        onClick={() => onToggleLayout()}
        className="min-h-12 min-w-12 p-2 rounded-xl bg-telegram-hover/30 hover:bg-telegram-hover/60 border border-telegram-border/40 text-telegram-subtext transition-all duration-300"
        aria-label={i18n.t('files.toggle_layout')}
        title={i18n.t('files.toggle_layout')}
      >
        {settings.viewMode === 'grid'
          ? <List className="mx-auto w-5 h-5" aria-hidden="true" />
          : <LayoutGrid className="mx-auto w-5 h-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
