import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomNavBar } from '../../src/components/mobile/BottomNavBar';

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === 'files'
    ? { data: [{ id: 10_004, name: 'real-dashboard-file.txt', size: 100, sizeStr: '100 B', folder_id: 101 }], isLoading: false }
    : { data: [], isLoading: false, refetch: vi.fn() },
  useQueryClient: () => ({ setQueryData: vi.fn(), invalidateQueries: vi.fn() }),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({ getTotalSize: () => 82, getVirtualItems: () => [{ index: 0, key: '0', start: 0 }], measure: vi.fn(), measureElement: vi.fn() }),
}));

vi.mock('../../src/hooks/useTelegramConnection', async () => {
  const React = await import('react');
  return {
    useTelegramConnection: () => {
      const [activeFolderId, setActiveFolderId] = React.useState<number | null>(101);
      return {
        store: {}, folders: [{ id: 101, name: 'Current folder' }], activeFolderId, setActiveFolderId,
        isSyncing: false, isConnected: true, handleLogout: vi.fn(), handleSyncFolders: vi.fn(), handleCreateFolder: vi.fn(),
        handleFolderDelete: vi.fn(), handleFolderRename: vi.fn(), handleFolderToggleVisibility: vi.fn(), handleExportFolderInvite: vi.fn(),
      };
    },
  };
});

vi.mock('../../src/context/SettingsContext', () => ({
  useSettings: () => ({
    settings: { fileSortField: 'name', fileSortDirection: 'asc', language: 'en', viewMode: 'list', driveTourSeen: true },
    updateSetting: vi.fn(), updateSettings: vi.fn(), isLoaded: true,
  }),
}));

vi.mock('../../src/context/SupporterContext', () => ({ useSupporter: () => ({ status: { ad_free: false } }) }));
vi.mock('../../src/hooks/usePlatform', () => ({ usePlatform: () => ({ isAndroid: false, isTelevision: false }) }));
vi.mock('../../src/hooks/useFileUpload', () => ({ useFileUpload: () => ({ uploadQueue: [], setUploadQueue: vi.fn(), handleManualUpload: vi.fn(), clearFinished: vi.fn(), cancelAll: vi.fn(), pauseAll: vi.fn(), resumeAll: vi.fn(), cancelItem: vi.fn(), retryItem: vi.fn() }) }));
vi.mock('../../src/hooks/useFileDownload', () => ({ useFileDownload: () => ({ downloadQueue: [], queueDownload: vi.fn(), queueBulkDownload: vi.fn(), clearFinished: vi.fn(), cancelAll: vi.fn(), pauseAll: vi.fn(), resumeAll: vi.fn(), cancelItem: vi.fn(), retryItem: vi.fn() }) }));
vi.mock('../../src/hooks/useFileOperations', () => ({ useFileOperations: () => ({ handleDelete: vi.fn(), handleBulkDelete: vi.fn(), handleBulkDownload: vi.fn(), handleBulkMove: vi.fn() }) }));
vi.mock('../../src/hooks/useMobileSettingsDiagnostics', () => ({ useMobileSettingsDiagnostics: () => ({ refetchOfflineCache: vi.fn() }) }));
vi.mock('../../src/hooks/useMobileTransferStatus', () => ({ useMobileTransferStatus: () => ({ activeUploadCount: 0, activeDownloadCount: 0, pausedUploadCount: 0, pausedDownloadCount: 0, networkWaitingCount: 0, aggregateTransferSpeed: 0 }) }));
vi.mock('../../src/hooks/useMobileIncomingShares', () => ({ useMobileIncomingShares: vi.fn() }));

function MobileNavigationHarness() {
  const [activeTab, setActiveTab] = useState<'files' | 'downloads' | 'settings'>('files');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const queue = ['queued-upload.pdf'];

  return (
    <div>
      <button type="button" onClick={() => setDrawerOpen(true)}>Open folders</button>
      {drawerOpen && <button type="button" onClick={() => setDrawerOpen(false)}>Close folders</button>}
      {activeTab === 'files' && <p>Files view</p>}
      {activeTab === 'downloads' && <p>{queue[0]}</p>}
      <footer><BottomNavBar activeTab={activeTab} setActiveTab={setActiveTab} embedded /></footer>
    </div>
  );
}

describe('Mobile dashboard navigation', () => {
  it('retains the queued item when tabs change and closes the folders drawer', () => {
    render(<MobileNavigationHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }));
    expect(screen.getByText('queued-upload.pdf')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Files' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open folders' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close folders' }));
    expect(screen.queryByRole('button', { name: 'Close folders' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }));
    expect(screen.getByText('queued-upload.pdf')).toBeTruthy();
  });

  it('clears active selection when the dashboard folder changes with default search filters', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    const { default: MobileDashboard } = await import('../../src/components/mobile/MobileDashboard');
    const { container } = render(<MobileDashboard />);
    await waitFor(() => expect(container.querySelector('[data-select-id="10004"]')).not.toBeNull());
    const file = container.querySelector<HTMLElement>('[data-select-id="10004"]')!;
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(file);
    expect(screen.getByRole('button', { name: 'Download (1)' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open folders' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saved Messages' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Download \(/ })).toBeNull());
  });
});
