import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import { useSettings } from '../context/SettingsContext';
import type { OfflineCacheStatus } from '../types';
import { copyToClipboard } from '../utils';

// These settings effects run throughout the dashboard lifetime, including while
// Files and Transfers are open. Each callback keeps its original backend flow.
export function useMobileSettingsDiagnostics(isAndroid: boolean, settingsTabActive: boolean) {
  const { settings, updateSetting, isLoaded: settingsLoaded } = useSettings();
  const { confirm } = useConfirm();
  const { t } = useTranslation();
  // Sync proxy settings to backend whenever they change
  useEffect(() => {
    const applyProxy = async () => {
      try {
        await invoke('cmd_apply_proxy_settings', {
          enabled: settings.proxyEnabled,
          proxyType: settings.proxyType,
          host: settings.proxyHost,
          port: settings.proxyPort,
          username: settings.proxyUsername,
          password: settings.proxyPassword,
        });
      } catch {
        // best-effort sync
      }
    };
    applyProxy();
  }, [
    settings.proxyEnabled, settings.proxyType, settings.proxyHost,
    settings.proxyPort, settings.proxyUsername, settings.proxyPassword,
  ]);

  // ── Connection diagnostics state ──────────────────────────────────────
  const [checkingLatency, setCheckingLatency] = useState(false);
  const [copyingDiagnostics, setCopyingDiagnostics] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const {
    data: offlineCache,
    isFetching: offlineCacheLoading,
    refetch: refetchOfflineCache,
  } = useQuery({
    queryKey: ['offline-cache-status'],
    queryFn: () => invoke<OfflineCacheStatus>('cmd_get_offline_cache_status'),
    enabled: settingsTabActive,
  });

  const clearOfflineCache = useCallback(async () => {
    const accepted = await confirm({
      title: t('settings.clear_offline_cache_title'),
      message: t('settings.clear_offline_cache_desc'),
      confirmText: t('settings.clear'),
      variant: 'danger',
    });
    if (!accepted) return;
    try {
      await invoke('cmd_clean_preview_cache');
      await refetchOfflineCache();
      toast.success(t('settings.offline_cache_cleared'));
    } catch {
      toast.error(t('settings.cache_clear_failed'));
    }
  }, [confirm, refetchOfflineCache, t]);

  useEffect(() => {
    if (!isAndroid || !settingsLoaded) return;
    void invoke('cmd_set_preview_cache_limit', { maxGb: settings.androidMediaCacheMaxGb })
      .then(() => refetchOfflineCache())
      .catch(error => console.warn('[Media] Unable to configure offline cache:', error));
  }, [isAndroid, refetchOfflineCache, settings.androidMediaCacheMaxGb, settingsLoaded]);

  const handleCheckLatency = useCallback(async () => {
    setCheckingLatency(true);
    setLatencyMs(null);
    try {
      const ms = await invoke<number>('cmd_check_latency');
      setLatencyMs(ms);
      if (ms >= 0) {
        const emoji = ms < 100 ? '🟢' : ms < 250 ? '🟡' : '🔴';
        toast.success(`${emoji} Ping: ${ms}ms to Telegram DC`);
      } else {
        toast.error('Unable to reach Telegram servers');
      }
    } catch (e) {
      console.warn('Ping check failed:', e);
      toast.error('Unable to reach Telegram servers');
      setLatencyMs(-1);
    } finally {
      setCheckingLatency(false);
    }
  }, []);

  const handleCopyDiagnostics = useCallback(async () => {
    setCopyingDiagnostics(true);
    try {
      const diagnostics = await invoke<string>('cmd_get_system_diagnostics');
      await copyToClipboard(diagnostics);
      toast.success(t('settings.diagnostics_copied'));
    } catch (error) {
      toast.error(t('settings.diagnostics_copy_failed', { error: String(error) }));
    } finally {
      setCopyingDiagnostics(false);
    }
  }, [t]);

  const handleBiometricLockToggle = useCallback(async () => {
    if (settings.androidBiometricLock) {
      updateSetting('androidBiometricLock', false);
      return;
    }
    try {
      const available = await invoke<boolean>('cmd_get_android_authentication_available');
      if (!available) {
        toast.error('Set a device PIN, pattern, password, or supported biometric before enabling app lock.');
        return;
      }
      const authenticated = await invoke<boolean>('cmd_android_authenticate', { reason: 'Authenticate to enable Telegram Drive app lock' });
      if (authenticated) updateSetting('androidBiometricLock', true);
    } catch (error) {
      toast.error(`Could not enable Android app lock: ${error}`);
    }
  }, [settings.androidBiometricLock, updateSetting]);

  useEffect(() => {
    if (!isAndroid || !settingsLoaded) return;
    void invoke<boolean>('cmd_configure_android_privacy', {
      biometricLock: settings.androidBiometricLock,
      privacyScreen: settings.androidPrivacyScreen,
      timeoutMinutes: settings.androidLockAfterBackgroundMinutes,
    }).then(available => {
      if (!available && settings.androidBiometricLock) updateSetting('androidBiometricLock', false);
    }).catch(error => console.warn('[Privacy] Unable to configure Android privacy:', error));
  }, [
    isAndroid,
    settings.androidBiometricLock,
    settings.androidLockAfterBackgroundMinutes,
    settings.androidPrivacyScreen,
    settingsLoaded,
    updateSetting,
  ]);

  return {
    checkingLatency, copyingDiagnostics, latencyMs, offlineCache, offlineCacheLoading,
    refetchOfflineCache, clearOfflineCache, handleCheckLatency, handleCopyDiagnostics,
    handleBiometricLockToggle,
  };
}
