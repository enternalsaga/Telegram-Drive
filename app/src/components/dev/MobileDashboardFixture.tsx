import { lazy, Suspense } from 'react';
import type { TelegramFile, TelegramFolder } from '../../types';
import type { DownloadItem, QueueItem } from '../../types/transfers';
import i18n from '../../i18n';

const MobileDashboard = lazy(() => import('../mobile/MobileDashboard'));

type NativeArgs = Record<string, unknown>;
type NativeCallback = (event: { event: string; payload: unknown }) => void;

const fixtureFolders: TelegramFolder[] = [
  { id: 101, name: 'Báo cáo dự án dài nhất có thể hiển thị trên điện thoại', username: 'mobile_fixture_reports', is_public: true },
  { id: 102, name: '写真と旅行の思い出', username: 'mobile_fixture_photos', is_public: true },
  { id: 103, name: 'مستندات الفريق المشتركة', username: 'mobile_fixture_rtl', is_public: false },
];

const fixtureFileNames = [
  'Báo cáo tài chính quý IV với phần phụ lục rất dài.pdf',
  '写真_東京_夜景_高解像度_最終版.jpg',
  'ملف_المستندات_المشتركة_النهائي_طويل_جداً.docx',
  'archive-with-a-deliberately-long-file-name-for-mobile-layout-testing.zip',
];

export const mobileDashboardFixtureFiles: TelegramFile[] = Array.from({ length: 500 }, (_, index) => {
  const name = index < fixtureFileNames.length
    ? fixtureFileNames[index]
    : `mobile-fixture-file-${String(index + 1).padStart(3, '0')}.txt`;
  return {
    id: 10_000 + index,
    name,
    size: 1_024 * (index + 1),
    sizeStr: `${index + 1} KB`,
    created_at: `2026-09-${String((index % 28) + 1).padStart(2, '0')}T12:00:00Z`,
    folder_id: 101,
    mime_type: name.endsWith('.jpg') ? 'image/jpeg' : 'text/plain',
    file_ext: name.split('.').pop(),
  };
});

const fixtureUploadQueue: QueueItem[] = [
  { id: 'fixture-upload-error', path: '/fixture/Báo cáo lỗi.pdf', folderId: 101, status: 'error', error: 'Fixture upload error' },
  { id: 'fixture-upload-paused', path: '/fixture/写真 paused.jpg', folderId: 101, status: 'paused' },
  { id: 'fixture-upload-waiting', path: '/fixture/ملف waiting.docx', folderId: 101, status: 'waiting_for_network' },
  { id: 'fixture-upload-completed', path: '/fixture/completed.txt', folderId: 101, status: 'success', progress: 100 },
];

const fixtureDownloadQueue: DownloadItem[] = [
  { id: 'fixture-download-error', messageId: 10_001, filename: 'Báo cáo lỗi.pdf', folderId: 101, status: 'error', error: 'Fixture download error' },
  { id: 'fixture-download-paused', messageId: 10_002, filename: '写真 paused.jpg', folderId: 101, status: 'paused' },
  { id: 'fixture-download-waiting', messageId: 10_003, filename: 'ملف waiting.docx', folderId: 101, status: 'waiting_for_network' },
  { id: 'fixture-download-completed', messageId: 10_004, filename: 'completed.txt', folderId: 101, status: 'success', progress: 100 },
];

function selectedSupporterStatus() {
  const state = new URLSearchParams(window.location.search).get('supporter') ?? 'unlicensed';
  if (state === 'active') {
    return { state: 'active', ad_free: true, message: 'Fixture supporter active', terms_version: '2026-08-11', terms_url: null, expires_at: null, offline_until: null, recovery_code_saved: true };
  }
  if (state === 'loading') {
    return { state: 'loading', ad_free: false, message: 'Checking supporter activation…', terms_version: '2026-08-11', terms_url: null, expires_at: null, offline_until: null, recovery_code_saved: false };
  }
  return { state: 'inactive', ad_free: false, message: 'Fixture supporter unlicensed', terms_version: '2026-08-11', terms_url: null, expires_at: null, offline_until: null, recovery_code_saved: false };
}

export function installMobileDashboardFixtureBridge(): void {
  if ((window as Window & { __mobileDashboardFixtureBridge?: boolean }).__mobileDashboardFixtureBridge) return;

  const stores = new Map<string, Map<string, unknown>>([
    ['config.json', new Map<string, unknown>([
      ['api_id', '12345'],
      ['folders', fixtureFolders],
      ['foldersLastSyncedAt', Date.now()],
      ['activeFolderId', 101],
      ['uploadQueue', fixtureUploadQueue],
      ['downloadQueue', fixtureDownloadQueue],
    ])],
    ['settings.json', new Map<string, unknown>([['settings', { driveTourSeen: true, fileSortField: 'size', fileSortDirection: 'asc' }]])],
  ]);
  const storeResources = new Map<number, Map<string, unknown>>();
  const callbacks = new Map<number, NativeCallback>();
  const eventListeners = new Map<string, number>();
  let nextResourceId = 1;
  let nextCallbackId = 1;
  let nextEventId = 1;

  const emit = (event: string, payload: unknown) => {
    for (const [eventId, callbackId] of eventListeners) {
      if (!eventId.startsWith(`${event}:`)) continue;
      callbacks.get(callbackId)?.({ event, payload });
    }
  };
  const unknown = (command: string): never => {
    throw new Error(`[mobile-dashboard fixture] Unmocked native command: ${command}`);
  };
  const invoke = async (command: string, args: NativeArgs = {}) => {
    if (command === 'plugin:store|load') {
      const path = String(args.path);
      const store = stores.get(path) ?? new Map<string, unknown>();
      stores.set(path, store);
      const resourceId = nextResourceId++;
      storeResources.set(resourceId, store);
      return resourceId;
    }
    if (command === 'plugin:store|get') {
      const store = storeResources.get(Number(args.rid));
      const key = String(args.key);
      return [store?.get(key), store?.has(key) ?? false];
    }
    if (command === 'plugin:store|set') {
      storeResources.get(Number(args.rid))?.set(String(args.key), args.value);
      return undefined;
    }
    if (command === 'plugin:store|delete') {
      storeResources.get(Number(args.rid))?.delete(String(args.key));
      return undefined;
    }
    if (command === 'plugin:store|save') return undefined;
    if (command === 'plugin:event|listen') {
      const eventId = `${String(args.event)}:${nextEventId++}`;
      eventListeners.set(eventId, Number(args.handler));
      return eventId;
    }
    if (command === 'plugin:event|unlisten') {
      eventListeners.delete(String(args.eventId));
      return undefined;
    }
    if (command === 'cmd_get_enriched_folders' || command === 'cmd_scan_folders') return fixtureFolders;
    if (command === 'cmd_get_groups') return [];
    if (command === 'cmd_get_files') {
      emit('folder-load-chunk', { folderId: args.folderId, files: mobileDashboardFixtureFiles.map(file => ({ ...file, icon_type: file.type })) });
      return undefined;
    }
    if (command === 'cmd_get_supporter_status' || command === 'cmd_refresh_supporter') return selectedSupporterStatus();
    if (command === 'cmd_get_bandwidth') return { date: '2026-09-12', up_bytes: 0, down_bytes: 0, limit_bytes: 0, period: 'weekly' };
    if (command === 'cmd_get_android_transfer_environment') return { connected: true, isTelevision: false, backgroundRestricted: false, metered: false, roaming: false, charging: true, batteryPercent: 100 };
    if (command === 'cmd_list_cached_files' || command === 'cmd_get_android_playback_history') return [];
    if (command === 'cmd_get_offline_cache_status') return { file_count: 0, total_bytes: 0, max_files: 500, max_bytes: 1_073_741_824 };
    if (command === 'cmd_get_encryption_capabilities') return { contract_version: 2, availability: 'disabled', message: 'Disabled in mobile fixture' };
    if (command === 'cmd_get_vault_status') return { is_configured: false, is_unlocked: false, has_recovery: false };
    if (command === 'cmd_get_crypto_inventory') return { total_files: 0, encrypted_files: 0, plaintext_files: 0 };
    if (command === 'cmd_get_encryption_settings') return { default_mode: 'standard', protect_metadata: false, auto_lock_minutes: 15, lock_on_sleep: false, temp_policy: 'delete_on_exit', remember_device: false };
    if (command === 'cmd_update_encryption_settings' || command === 'cmd_apply_proxy_settings' || command === 'cmd_configure_android_transfer_recovery' || command === 'cmd_set_preview_cache_limit' || command === 'cmd_configure_android_privacy') return command === 'cmd_configure_android_privacy' ? true : undefined;
    return unknown(command);
  };

  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {
      invoke,
      transformCallback(callback: NativeCallback) {
        const callbackId = nextCallbackId++;
        callbacks.set(callbackId, callback);
        return callbackId;
      },
      unregisterCallback(callbackId: number) { callbacks.delete(callbackId); },
      convertFileSrc: (path: string) => path,
    },
  });
  Object.defineProperty(window, '__TAURI_EVENT_PLUGIN_INTERNALS__', {
    configurable: true,
    value: { unregisterListener: (_event: string, eventId: string) => eventListeners.delete(eventId) },
  });
  Object.defineProperty(window, '__TAURI_OS_PLUGIN_INTERNALS__', {
    configurable: true,
    value: { os_type: 'android' },
  });
  (window as Window & { __mobileDashboardFixtureBridge?: boolean }).__mobileDashboardFixtureBridge = true;
}

export default function MobileDashboardFixture() {
  installMobileDashboardFixtureBridge();
  if (new URLSearchParams(window.location.search).has('locale-stress')) {
    i18n.addResourceBundle('en', 'translation', {
      common: { app_title: 'TelegramDriveモバイル表示幅確認用の非常に長いアプリケーションタイトル' },
    }, true, true);
  }

  return (
    <div data-mobile-dashboard-fixture>
      <Suspense fallback={null}><MobileDashboard onLogout={() => undefined} /></Suspense>
    </div>
  );
}
