import { Heart, ChevronDown, Wifi, Activity, Zap, Database, RefreshCw, Shield, Share2, UploadCloud, HelpCircle, ExternalLink, Globe, LogOut } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '../shared/ThemeToggle';
import { MobileSupporterCard } from './MobileSupporterCard';
import { BandwidthWidget } from '../desktop/dashboard/BandwidthWidget';
import type { Settings, BandwidthStats } from '../../types';
import type { useSettings } from '../../context/SettingsContext';
import type { SupporterStatus } from '../../context/SupporterContext';
import type { useMobileSettingsDiagnostics } from '../../hooks/useMobileSettingsDiagnostics';
import type { AndroidTransferEnvironment } from '../../services/androidTransferPolicy';
import { shouldOfferNewSupporterPurchase } from '../../services/supporterVisibility';
import { formatBytes } from '../../utils';
import { LANGUAGES } from '../../i18n/languages';
import { version as appVersion } from '../../../package.json';
import i18n from '../../i18n';

export interface CachedFileEntry {
  uri: string;
  cached_path: string;
  file_name: string;
  file_size: number;
}

function MobileSettingToggle({ checked, label, description, onChange }: {
  checked: boolean;
  label: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-telegram-border/20 py-3 last:border-b-0">
      <div>
        <p className="text-xs font-medium text-telegram-text">{label}</p>
        <p className="mt-0.5 text-[10px] leading-4 text-telegram-subtext">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-telegram-primary' : 'bg-telegram-border'}`}>
        <span className={`absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5 rtl:-translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

interface MobileSettingsPanelProps {
  settings: Settings;
  updateSetting: ReturnType<typeof useSettings>['updateSetting'];
  supporterStatus: SupporterStatus;
  openMobileSupporter: () => void;
  isConnected: boolean;
  isAndroid: boolean;
  transferAllowed: boolean;
  transferWaitingReason: string;
  androidTransferEnvironment: AndroidTransferEnvironment | undefined;
  bandwidth: BandwidthStats | undefined;
  diagnostics: ReturnType<typeof useMobileSettingsDiagnostics>;
  cachedFiles: CachedFileEntry[];
  uploadingCacheFiles: Set<string>;
  handleUploadCachedFile: (entry: CachedFileEntry) => Promise<void>;
  handleClearCachedFiles: () => Promise<void>;
  setShowHelp: (open: boolean) => void;
  handleLogout: () => void;
}

export function MobileSettingsPanel({ settings, updateSetting, supporterStatus, openMobileSupporter, isConnected, isAndroid, transferAllowed, transferWaitingReason, androidTransferEnvironment, bandwidth, diagnostics, cachedFiles, uploadingCacheFiles, handleUploadCachedFile, handleClearCachedFiles, setShowHelp, handleLogout }: MobileSettingsPanelProps) {
  const { t } = useTranslation();
  const { checkingLatency, copyingDiagnostics, latencyMs, offlineCache, offlineCacheLoading,
    refetchOfflineCache, clearOfflineCache, handleCheckLatency, handleCopyDiagnostics,
    handleBiometricLockToggle } = diagnostics;
  // Preserve the established settings sections and their sequential display order.
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-telegram-border/30 bg-telegram-hover/20 p-4">
        <div>
          <h2 className="text-sm font-bold text-telegram-text">Appearance</h2>
          <p className="mt-0.5 text-[10px] text-telegram-subtext">Choose the app theme.</p>
        </div>
        <ThemeToggle />
      </div>
      {shouldOfferNewSupporterPurchase(supporterStatus) && !supporterStatus.checkout_pending && (
        <button
          type="button"
          onClick={openMobileSupporter}
          className="flex w-full items-center gap-3 rounded-2xl border border-telegram-primary/30 bg-gradient-to-r from-telegram-primary/15 to-telegram-hover/20 p-4 text-left shadow-sm transition-transform active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-telegram-primary/20 text-telegram-primary">
            <Heart className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-telegram-text">$5 lifetime ad-free</span>
            <span className="mt-0.5 block text-[10px] leading-4 text-telegram-subtext">Remove sponsor ads forever. One payment, no subscription.</span>
          </span>
          <span className="text-lg text-telegram-primary" aria-hidden="true">›</span>
        </button>
      )}
      <div className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-4">
        <h3 className="text-sm font-bold text-telegram-primary tracking-wide uppercase text-[10px]">{t('common.preferences')}</h3>
        <div className="flex items-center justify-between py-2 border-b border-telegram-border/20">
          <div>
            <p className="text-xs font-medium">{t('settings.zip_before_upload')}</p>
            <p className="text-[10px] text-telegram-subtext">{t('settings.zip_folders_desc')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.zipFolders}
            aria-label={t('settings.zip_before_upload')}
            onClick={() => updateSetting('zipFolders', !settings.zipFolders)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${settings.zipFolders ? 'bg-telegram-primary' : 'bg-telegram-border'}`}
          >
            <span className={`absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${settings.zipFolders ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-telegram-border/20 py-2">
          <div>
            <p className="text-xs font-medium">{t('settings.video_upload_default')}</p>
            <p className="text-[10px] leading-4 text-telegram-subtext">{t('settings.video_upload_desc')}</p>
          </div>
          <select
            value={settings.videoUploadMode}
            onChange={event => updateSetting('videoUploadMode', event.target.value as 'file' | 'media')}
            aria-label={t('settings.video_upload_default')}
            className="min-h-11 shrink-0 rounded-lg border border-telegram-border bg-telegram-bg px-2 text-xs text-telegram-text"
          >
            <option value="file">{t('settings.video_upload_file')}</option>
            <option value="media">{t('settings.video_upload_media')}</option>
          </select>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-xs font-medium">{t('common.language')}</p>
            <p className="text-[10px] text-telegram-subtext">{t('settings.select_app_language')}</p>
          </div>
          <div className="relative">
            <select
              value={settings.language}
              onChange={e => updateSetting('language', e.target.value as Settings['language'])}
              className="appearance-none bg-telegram-bg border border-telegram-border rounded-lg pl-2.5 pr-7 py-1.5 text-xs text-telegram-text focus:outline-none focus:border-telegram-primary/50 transition cursor-pointer"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeLabel}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-telegram-subtext absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Connection Diagnostics */}
      <div className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-4">
        <h3 className="text-sm font-bold text-telegram-primary tracking-wide uppercase text-[10px] flex items-center gap-1.5">
          <Wifi className="w-3 h-3" />
          {t('settings.connection_diagnostics')}
        </h3>

        {/* Connection status indicator */}
        <div className="flex items-center justify-between py-2 border-b border-telegram-border/20">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-telegram-subtext" />
            <p className="text-xs font-medium">{t('common.status')}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className={`text-xs font-semibold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? t('common.connected_telegram') : t('settings.offline')}
            </span>
          </div>
        </div>

        {/* Ping test */}
        <div className="flex items-center justify-between py-2 border-b border-telegram-border/20">
          <div>
            <p className="text-xs font-medium">{t('common.ping')}</p>
            <p className="text-[10px] text-telegram-subtext">
              {latencyMs !== null
                ? latencyMs >= 0
                  ? `${latencyMs}ms`
                  : t('settings.offline')
                : t('settings.not_tested')}
            </p>
          </div>
          <button
            onClick={handleCheckLatency}
            disabled={checkingLatency}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-telegram-primary/15 text-telegram-primary hover:bg-telegram-primary/25 border border-telegram-primary/20 active:scale-95 transition-all duration-200 disabled:opacity-50"
          >
            {checkingLatency ? (
              <>
                <div className="w-3 h-3 border-2 border-telegram-primary/30 border-t-telegram-primary rounded-full animate-spin" />
                {t('settings.testing')}
              </>
            ) : (
              <>
                <Zap className="w-3 h-3" />
                {t('settings.check_ping')}
              </>
            )}
          </button>
        </div>

        {/* Latency quality bar */}
        {latencyMs !== null && latencyMs >= 0 && (
          <div className="flex items-center gap-2 py-1">
            <div className="flex-1 h-1.5 rounded-full bg-telegram-border/30 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${latencyMs < 100 ? 'bg-green-500' : latencyMs < 250 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, Math.max(5, (500 - latencyMs) / 5))}%` }}
              />
            </div>
            <span className={`text-[10px] font-semibold ${latencyMs < 100 ? 'text-green-400' : latencyMs < 250 ? 'text-yellow-400' : 'text-red-400'}`}>
              {latencyMs < 100 ? t('settings.excellent') : latencyMs < 250 ? t('settings.good') : t('settings.slow')}
            </span>
          </div>
        )}

        {/* Bandwidth stats */}
        {bandwidth && (
          <div className="py-2">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-medium">250 GB weekly limit</p><p className="text-[10px] text-telegram-subtext">Uploads and downloads reset Monday</p></div>
              <p className="text-[11px] font-mono font-semibold text-telegram-text">
                <span className="text-emerald-400">↑ {formatBytes(bandwidth.up_bytes)}</span>
                {' · '}
                <span className="text-blue-400">↓ {formatBytes(bandwidth.down_bytes)}</span>
              </p>
            </div>
            <BandwidthWidget bandwidth={bandwidth} />
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-telegram-border/20 pt-3">
          <div>
            <p className="text-xs font-medium">Sanitized support snapshot</p>
            <p className="text-[10px] text-telegram-subtext">Includes app/device state and recent process-exit codes—never filenames, paths, messages, account IDs, or tokens.</p>
          </div>
          <button type="button" onClick={() => void handleCopyDiagnostics()} disabled={copyingDiagnostics} className="min-h-11 shrink-0 rounded-xl border border-telegram-primary/20 bg-telegram-primary/15 px-3 text-xs font-semibold text-telegram-primary disabled:opacity-50">
            {copyingDiagnostics ? t('common.loading') : t('settings.copy_diagnostics')}
          </button>
        </div>
      </div>

      {isAndroid && (
        <section className="rounded-2xl border border-telegram-border/30 bg-telegram-hover/20 p-4" aria-labelledby="android-transfer-policy-title">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h3 id="android-transfer-policy-title" className="text-[10px] font-bold uppercase tracking-wide text-telegram-primary">Android transfer reliability</h3>
              <p className="mt-1 text-[10px] leading-4 text-telegram-subtext">Saved queues resume after reopening. Android will notify you after a reboot or process interruption.</p>
            </div>
            <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${transferAllowed ? 'bg-emerald-400' : 'bg-amber-400'}`} title={transferWaitingReason} />
          </div>
          <MobileSettingToggle checked={settings.androidWifiOnlyTransfers} label="Wi-Fi only" description="Wait for an unmetered network before uploading or downloading." onChange={() => updateSetting('androidWifiOnlyTransfers', !settings.androidWifiOnlyTransfers)} />
          <MobileSettingToggle checked={settings.androidAllowRoaming} label="Allow roaming" description="Disabled by default to prevent unexpected carrier charges." onChange={() => updateSetting('androidAllowRoaming', !settings.androidAllowRoaming)} />
          <MobileSettingToggle checked={settings.androidRequireCharging} label="Require charging" description="Only run queued transfers while external power is connected." onChange={() => updateSetting('androidRequireCharging', !settings.androidRequireCharging)} />
          <MobileSettingToggle checked={settings.androidPauseOnLowBattery} label="Pause on low battery" description="Wait when battery is 15% or lower unless the device is charging." onChange={() => updateSetting('androidPauseOnLowBattery', !settings.androidPauseOnLowBattery)} />
          <label className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span><span className="block font-medium text-telegram-text">Free-space reserve</span><span className="mt-0.5 block text-[10px] text-telegram-subtext">Downloads never consume this reserve.</span></span>
            <select value={settings.androidMinimumFreeStorageGb} onChange={event => updateSetting('androidMinimumFreeStorageGb', Number(event.target.value))} className="min-h-11 rounded-lg border border-telegram-border bg-telegram-bg px-3 text-xs text-telegram-text">
              {[1, 2, 5, 10].map(value => <option key={value} value={value}>{value} GB</option>)}
            </select>
          </label>
          {!transferAllowed && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[10px] text-amber-300">{transferWaitingReason}</p>}
          {androidTransferEnvironment?.backgroundRestricted && <p className="mt-2 text-[10px] text-amber-300">Android battery settings currently restrict this app. Transfers will recover from the saved queue when you reopen it.</p>}
        </section>
      )}

      <div className="rounded-2xl border border-telegram-border/30 bg-telegram-hover/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-2.5">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-telegram-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium">{t('settings.offline_cache')}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-telegram-subtext">{t('settings.offline_cache_desc')}</p>
              <p className="mt-1 text-[10px] font-mono text-telegram-primary">
                {offlineCache
                  ? t('settings.offline_cache_usage', { count: offlineCache.file_count, used: formatBytes(offlineCache.total_bytes), limit: formatBytes(offlineCache.max_bytes) })
                  : t('common.loading')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => void refetchOfflineCache()} disabled={offlineCacheLoading} className="min-h-11 min-w-11 rounded-xl p-2 text-telegram-subtext" aria-label={t('settings.refresh_offline_cache')}>
              <RefreshCw className={`mx-auto h-4 w-4 ${offlineCacheLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => void clearOfflineCache()} disabled={!offlineCache?.file_count || offlineCacheLoading} className="min-h-11 rounded-xl bg-red-500/10 px-3 text-[11px] font-semibold text-red-400 disabled:opacity-40">
              {t('settings.clear')}
            </button>
          </div>
        </div>
      </div>

      {isAndroid && (
        <section className="rounded-2xl border border-telegram-border/30 bg-telegram-hover/20 p-4" aria-labelledby="android-media-title">
          <h3 id="android-media-title" className="mb-2 text-[10px] font-bold uppercase tracking-wide text-telegram-primary">Media &amp; playback</h3>
          <MobileSettingToggle checked={settings.androidPrivateMediaMetadata} label="Private system metadata" description="Show “Private media” instead of filenames on the lock screen, Bluetooth devices, and system controls." onChange={() => updateSetting('androidPrivateMediaMetadata', !settings.androidPrivateMediaMetadata)} />
          <div className="grid grid-cols-2 gap-3 py-3">
            <label className="text-[10px] text-telegram-subtext">Playback speed<select value={settings.androidPlaybackSpeed} onChange={event => updateSetting('androidPlaybackSpeed', Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-telegram-border bg-telegram-bg px-2 text-xs text-telegram-text">{[0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
            <label className="text-[10px] text-telegram-subtext">Movie orientation<select value={settings.androidMediaOrientation} onChange={event => updateSetting('androidMediaOrientation', event.target.value as 'auto' | 'landscape' | 'portrait')} className="mt-1 min-h-11 w-full rounded-lg border border-telegram-border bg-telegram-bg px-2 text-xs text-telegram-text"><option value="auto">{i18n.t("settings.auto")}</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>
            <label className="text-[10px] text-telegram-subtext">Subtitle size<select value={settings.androidSubtitleScale} onChange={event => updateSetting('androidSubtitleScale', Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-telegram-border bg-telegram-bg px-2 text-xs text-telegram-text"><option value={0.8}>Small</option><option value={1}>Default</option><option value={1.25}>Large</option><option value={1.5}>Extra large</option></select></label>
            <label className="text-[10px] text-telegram-subtext">Offline cache<select value={settings.androidMediaCacheMaxGb} onChange={event => updateSetting('androidMediaCacheMaxGb', Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-telegram-border bg-telegram-bg px-2 text-xs text-telegram-text">{[0.5, 1, 2, 5, 10, 25].map(value => <option key={value} value={value}>{value} GB</option>)}</select></label>
          </div>
          <p className="text-[10px] leading-4 text-telegram-subtext">Audio/subtitle track selection and playback speed are also available from the player controls. Playback position is saved per file.</p>
        </section>
      )}

      {isAndroid && (
        <section className="rounded-2xl border border-telegram-border/30 bg-telegram-hover/20 p-4" aria-labelledby="android-privacy-title">
          <h3 id="android-privacy-title" className="mb-2 text-[10px] font-bold uppercase tracking-wide text-telegram-primary">Device privacy</h3>
          <MobileSettingToggle checked={settings.androidBiometricLock} label="Biometric or device lock" description="Require a biometric, PIN, pattern, or device password after Telegram Drive has been in the background." onChange={() => void handleBiometricLockToggle()} />
          <MobileSettingToggle checked={settings.androidPrivacyScreen} label="Block screenshots & Recents previews" description="Use Android FLAG_SECURE for the app and sensitive in-app media." onChange={() => updateSetting('androidPrivacyScreen', !settings.androidPrivacyScreen)} />
          <label className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span><span className="block font-medium text-telegram-text">Lock after backgrounding</span><span className="mt-0.5 block text-[10px] text-telegram-subtext">Applies when device lock is enabled.</span></span>
            <select value={settings.androidLockAfterBackgroundMinutes} onChange={event => updateSetting('androidLockAfterBackgroundMinutes', Number(event.target.value))} disabled={!settings.androidBiometricLock} className="min-h-11 rounded-lg border border-telegram-border bg-telegram-bg px-3 text-xs text-telegram-text disabled:opacity-50"><option value={0}>Immediately</option><option value={1}>1 minute</option><option value={5}>5 minutes</option><option value={15}>15 minutes</option><option value={60}>1 hour</option></select>
          </label>
        </section>
      )}

      {/* Proxy Configuration */}
      <div className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-4">
        <h3 className="text-sm font-bold text-telegram-primary tracking-wide uppercase text-[10px] flex items-center gap-1.5">
          <Shield className="w-3 h-3" />
          {t('common.proxy')}
        </h3>

        {/* Enable Proxy Toggle */}
        <div className="flex items-center justify-between py-2 border-b border-telegram-border/20">
          <div>
            <p className="text-xs font-medium">{t('common.enable_proxy')}</p>
            <p className="text-[10px] text-telegram-subtext">{t('settings.enable_proxy_desc')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.proxyEnabled}
            aria-label={t('common.enable_proxy')}
            onClick={() => updateSetting('proxyEnabled', !settings.proxyEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${settings.proxyEnabled ? 'bg-telegram-primary' : 'bg-telegram-border'}`}
          >
            <span className={`absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${settings.proxyEnabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Proxy Type */}
        <div className="flex items-center justify-between py-2 border-b border-telegram-border/20">
          <div>
            <p className="text-xs font-medium">{t('common.proxy_type')}</p>
            <p className="text-[10px] text-telegram-subtext">{t('settings.socks5_desc_mobile')}</p>
          </div>
          <div className="relative">
            <select
              value={settings.proxyType}
              onChange={e => updateSetting('proxyType', e.target.value as 'socks5')}
              className="appearance-none bg-telegram-bg border border-telegram-border rounded-lg pl-2.5 pr-7 py-1.5 text-xs text-telegram-text focus:outline-none focus:border-telegram-primary/50 transition cursor-pointer"
            >
              <option value="socks5">SOCKS5</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-telegram-subtext absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Host */}
        <div className="flex items-center justify-between py-2 border-b border-telegram-border/20">
          <div>
            <p className="text-xs font-medium">{t('common.host')}</p>
            <p className="text-[10px] text-telegram-subtext">{t('settings.host_desc')}</p>
          </div>
          <input
            type="text"
            placeholder="127.0.0.1"
            value={settings.proxyHost}
            onChange={e => updateSetting('proxyHost', e.target.value)}
            className="w-32 bg-telegram-bg border border-telegram-border rounded-lg px-2 py-1.5 text-xs text-telegram-text text-right focus:outline-none focus:border-telegram-primary/50 transition placeholder:text-telegram-subtext/40"
          />
        </div>

        {/* Port */}
        <div className="flex items-center justify-between py-2 border-b border-telegram-border/20">
          <div>
            <p className="text-xs font-medium">{t('common.port')}</p>
            <p className="text-[10px] text-telegram-subtext">{t('settings.port_desc')}</p>
          </div>
          <input
            type="number"
            min="1"
            max="65535"
            value={settings.proxyPort}
            onChange={e => updateSetting('proxyPort', Math.max(1, Math.min(65535, parseInt(e.target.value) || 1080)))}
            className="w-20 bg-telegram-bg border border-telegram-border rounded-lg px-2 py-1.5 text-xs text-telegram-text text-center focus:outline-none focus:border-telegram-primary/50 transition"
          />
        </div>

        {/* SOCKS5 auth fields */}
        {settings.proxyType === 'socks5' && (
          <>
            <div className="flex items-center justify-between py-2 border-b border-telegram-border/20">
              <div>
                <p className="text-xs font-medium">{t('common.username')}</p>
                <p className="text-[10px] text-telegram-subtext">{t('settings.optional')}</p>
              </div>
              <input
                type="text"
                placeholder={t('settings.optional')}
                value={settings.proxyUsername}
                onChange={e => updateSetting('proxyUsername', e.target.value)}
                className="w-32 bg-telegram-bg border border-telegram-border rounded-lg px-2 py-1.5 text-xs text-telegram-text text-right focus:outline-none focus:border-telegram-primary/50 transition placeholder:text-telegram-subtext/40"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-xs font-medium">{t('common.password')}</p>
                <p className="text-[10px] text-telegram-subtext">{t('settings.optional')}</p>
              </div>
              <input
                type="password"
                placeholder={t('settings.optional')}
                value={settings.proxyPassword}
                onChange={e => updateSetting('proxyPassword', e.target.value)}
                className="w-32 bg-telegram-bg border border-telegram-border rounded-lg px-2 py-1.5 text-xs text-telegram-text text-right focus:outline-none focus:border-telegram-primary/50 transition placeholder:text-telegram-subtext/40"
              />
            </div>
          </>
        )}

        {/* Info note */}
        <div className="p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
          <p className="text-[10px] text-yellow-400/70 leading-relaxed">
            {t('settings.proxy_reconnect_note')}
          </p>
        </div>
      </div>

      {/* Shared Files (Android only) */}
      {isAndroid && cachedFiles.length > 0 && (
        <div className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-4">
          <h3 className="text-sm font-bold text-telegram-primary tracking-wide uppercase text-[10px] flex items-center gap-1.5">
            <Share2 className="w-3 h-3" />
            {t('settings.shared_files', { count: cachedFiles.length })}
          </h3>
          <div className="space-y-2">
            {cachedFiles.map((entry) => {
              const isUploading = uploadingCacheFiles.has(entry.cached_path);
              return (
                <div
                  key={entry.cached_path}
                  className="flex items-center justify-between p-3 rounded-xl bg-telegram-bg/50 border border-telegram-border/30"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-xs font-semibold text-telegram-text truncate">{entry.file_name}</p>
                    <p className="text-[10px] text-telegram-subtext/60 font-mono">{formatBytes(entry.file_size)}</p>
                  </div>
                  <button
                    onClick={() => handleUploadCachedFile(entry)}
                    disabled={isUploading || !isConnected}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-telegram-primary text-black hover:bg-telegram-primary/95 border border-telegram-primary/10 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        {t('settings.uploading')}
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3 h-3" />
                        {t('common.upload')}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={handleClearCachedFiles}
            className="w-full text-center text-[10px] text-red-400/60 hover:text-red-400 transition-colors py-1"
          >
            {t('settings.clear_shared_files')}
          </button>
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-telegram-border/30 bg-telegram-hover/20 p-4">
        <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-telegram-primary">
          <Shield className="h-3 w-3" aria-hidden="true" />
          Privacy &amp; support
        </h3>
        <div id="mobile-supporter-card" className="scroll-mt-24">
          <MobileSupporterCard />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-telegram-border/40 bg-telegram-bg/50 px-3 py-2.5 text-[11px] font-semibold text-telegram-text"
          >
            <HelpCircle className="h-3.5 w-3.5 text-telegram-primary" aria-hidden="true" />
            Help &amp; FAQ
          </button>
          <button
            type="button"
            onClick={() => openUrl('https://github.com/caamer20/Telegram-Drive/blob/main/PRIVACY.md')}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-telegram-border/40 bg-telegram-bg/50 px-3 py-2.5 text-[11px] font-semibold text-telegram-text"
          >
            Privacy policy <ExternalLink className="h-3 w-3 text-telegram-primary" aria-hidden="true" />
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-telegram-subtext">Credentials and settings stay on this device. File transfers go directly between this app and Telegram; sponsor content is provided by the named advertising service.</p>
      </div>

      <div className="p-4 rounded-2xl bg-telegram-hover/20 border border-telegram-border/30 space-y-4">
        <h3 className="text-sm font-bold text-telegram-primary tracking-wide uppercase text-[10px]">{t('common.about')}</h3>
        <div className="flex flex-col items-center py-3 space-y-4">
          <img src="/logo.svg" className="w-14 h-14 drop-shadow-lg" alt="Telegram Drive Logo" />
          <div className="text-center">
            <p className="text-sm font-bold text-telegram-text">{i18n.t("common.app_title")}</p>
            <p className="text-[11px] text-telegram-subtext mt-0.5">v{appVersion}</p>
          </div>

          <div className="w-10 h-px bg-telegram-border" />

          <div className="text-center space-y-2.5">
            <p className="text-xs font-semibold text-telegram-text">Cameron Amer</p>

            <button
              onClick={(e) => { e.preventDefault(); openUrl('https://www.cameronamer.com'); }}
              className="flex items-center justify-center gap-1.5 text-[11px] text-telegram-primary hover:text-telegram-primary/80 transition-colors cursor-pointer"
            >
              <Globe className="w-3 h-3" />
              www.cameronamer.com
            </button>

            <button
              onClick={(e) => { e.preventDefault(); openUrl('https://github.com/caamer20/telegram-drive'); }}
              className="flex items-center justify-center gap-1.5 text-[11px] text-telegram-primary hover:text-telegram-primary/80 transition-colors cursor-pointer"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              github.com/caamer20/telegram-drive
            </button>
          </div>

          <p className="text-[10px] text-telegram-subtext/60 leading-relaxed text-center px-2">
            {t('settings.tagline')}
          </p>
        </div>
      </div>

      <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold text-xs active:scale-98 transition-all duration-200">
        <LogOut className="w-4 h-4" />
        {t('common.logout')}
      </button>
    </div>
  );
}
