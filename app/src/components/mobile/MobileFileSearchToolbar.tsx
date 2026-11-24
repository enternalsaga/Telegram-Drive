import { Filter, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileSearchFilters } from '../../services/fileSearch';
import type { RegisterMobileBackHandler } from '../../hooks/useMobileBackHandlers';
import { MobileBottomSheet } from './MobileBottomSheet';

interface MobileFileSearchToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  filters: FileSearchFilters;
  onFiltersChange: (filters: FileSearchFilters) => void;
  onReset: () => void;
  resultCount: number;
  isLoading: boolean;
  registerBackHandler?: RegisterMobileBackHandler;
}

export function MobileFileSearchToolbar({ query, onQueryChange, filters, onFiltersChange, onReset, resultCount, isLoading, registerBackHandler }: MobileFileSearchToolbarProps) {
  const { t } = useTranslation();
  const [showFilters, setShowFilters] = useState(false);
  const activeFacetCount = useMemo(
    () => [filters.type !== 'all', filters.size !== 'any', filters.date !== 'any'].filter(Boolean).length,
    [filters.date, filters.size, filters.type],
  );

  useEffect(
    () => showFilters ? registerBackHandler?.('file-search-filters', 110, () => setShowFilters(false)) : undefined,
    [registerBackHandler, showFilters],
  );

  const updateFilter = <K extends keyof FileSearchFilters>(key: K, value: FileSearchFilters[K]) => {
    onFiltersChange({ ...filters, scope: 'folder', [key]: value });
  };

  return (
    <section className="space-y-2" aria-label={t('mobile_search.title')}>
      <div className="flex min-w-0 items-center gap-2">
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-telegram-border/40 bg-telegram-hover/20 px-3 text-telegram-subtext focus-within:border-telegram-primary">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-telegram-text outline-none placeholder:text-telegram-subtext"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('common.search_placeholder')}
            aria-label={t('mobile_search.input_label')}
          />
          {query && (
            <button type="button" onClick={() => onQueryChange('')} className="min-h-9 min-w-9 rounded-lg p-2" aria-label={t('mobile_search.clear')}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </label>
        <button type="button" onClick={() => setShowFilters(true)} className="relative min-h-12 min-w-12 rounded-xl border border-telegram-border/40 bg-telegram-hover/30 p-2 text-telegram-subtext" aria-label={t('mobile_search.filters')}>
          <Filter className="mx-auto h-5 w-5" aria-hidden="true" />
          {activeFacetCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-telegram-primary px-1 text-[10px] font-bold text-black">{activeFacetCount}</span>}
        </button>
      </div>
      <p className="px-1 text-xs text-telegram-subtext" aria-live="polite" aria-busy={isLoading}>
        {isLoading ? t('common.loading') : t('mobile_search.results', { count: resultCount })}
      </p>

      {showFilters && (
        <MobileBottomSheet title={t('mobile_search.filters')} onClose={() => setShowFilters(false)}>
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-telegram-subtext">{t('mobile_search.type')}
              <select className="mt-1 min-h-11 w-full rounded-xl border border-telegram-border/40 bg-telegram-hover/20 px-3 text-sm text-telegram-text" value={filters.type} onChange={(event) => updateFilter('type', event.target.value as FileSearchFilters['type'])}>
                <option value="all">{t('mobile_search.type_all')}</option><option value="image">{t('mobile_search.type_image')}</option><option value="video">{t('mobile_search.type_video')}</option><option value="audio">{t('mobile_search.type_audio')}</option><option value="document">{t('mobile_search.type_document')}</option><option value="archive">{t('mobile_search.type_archive')}</option><option value="other">{t('mobile_search.type_other')}</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-telegram-subtext">{t('mobile_search.size')}
              <select className="mt-1 min-h-11 w-full rounded-xl border border-telegram-border/40 bg-telegram-hover/20 px-3 text-sm text-telegram-text" value={filters.size} onChange={(event) => updateFilter('size', event.target.value as FileSearchFilters['size'])}>
                <option value="any">{t('mobile_search.size_any')}</option><option value="small">{t('mobile_search.size_small')}</option><option value="medium">{t('mobile_search.size_medium')}</option><option value="large">{t('mobile_search.size_large')}</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-telegram-subtext">{t('mobile_search.date')}
              <select className="mt-1 min-h-11 w-full rounded-xl border border-telegram-border/40 bg-telegram-hover/20 px-3 text-sm text-telegram-text" value={filters.date} onChange={(event) => updateFilter('date', event.target.value as FileSearchFilters['date'])}>
                <option value="any">{t('mobile_search.date_any')}</option><option value="7d">{t('mobile_search.date_7d')}</option><option value="30d">{t('mobile_search.date_30d')}</option><option value="1y">{t('mobile_search.date_1y')}</option>
              </select>
            </label>
            <button type="button" onClick={() => { onReset(); setShowFilters(false); }} className="min-h-11 w-full rounded-xl border border-telegram-border/40 px-3 text-sm font-semibold text-telegram-subtext">{t('mobile_search.reset')}</button>
          </div>
        </MobileBottomSheet>
      )}
    </section>
  );
}
