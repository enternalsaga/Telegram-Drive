import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MobileFolderDrawer } from '../../src/components/mobile/MobileFolderDrawer';

function renderDrawer(handleCreateFolder: (name: string) => Promise<void>) {
  return render(
    <MobileFolderDrawer
      isSidebarOpen
      setIsSidebarOpen={vi.fn()}
      activeFolderId={null}
      setActiveFolderId={vi.fn()}
      folders={[]}
      setFolderActionMenu={vi.fn()}
      folderActionMenu={null}
      buildFolderActions={() => []}
      renameFolder={null}
      setRenameFolder={vi.fn()}
      handleFolderRename={vi.fn()}
      handleCreateFolder={handleCreateFolder}
      bandwidth={undefined}
      isConnected
    />,
  );
}

function createFolderButtons() {
  return screen.getAllByRole('button', { name: /Create Folder/ });
}

describe('MobileFolderDrawer create-folder sheet', () => {
  it('resets submission after a successful create so reopening enables the form', async () => {
    const user = userEvent.setup();
    const handleCreateFolder = vi.fn(async () => undefined);
    renderDrawer(handleCreateFolder);

    await user.click(createFolderButtons()[0]);
    const input = screen.getByPlaceholderText('Folder name');
    await user.type(input, 'Receipts');
    await user.click(createFolderButtons()[1]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create Folder' })).toBeNull());

    await user.click(createFolderButtons()[0]);
    const reopenedInput = screen.getByPlaceholderText('Folder name') as HTMLInputElement;
    expect(reopenedInput.disabled).toBe(false);
    await user.type(reopenedInput, 'Invoices');
    expect(createFolderButtons()[1].hasAttribute('disabled')).toBe(false);
  });

  it('retains the input and reenables submission when folder creation fails', async () => {
    const user = userEvent.setup();
    const handleCreateFolder = vi.fn(async () => { throw new Error('offline'); });
    renderDrawer(handleCreateFolder);

    await user.click(createFolderButtons()[0]);
    const input = screen.getByPlaceholderText('Folder name') as HTMLInputElement;
    await user.type(input, 'Retry folder');
    await user.click(createFolderButtons()[1]);
    await waitFor(() => expect(input.disabled).toBe(false));
    expect(input.value).toBe('Retry folder');
    expect(createFolderButtons()[1].hasAttribute('disabled')).toBe(false);
    await user.click(createFolderButtons()[1]);
    await waitFor(() => expect(handleCreateFolder).toHaveBeenCalledTimes(2));
    expect(handleCreateFolder).toHaveBeenNthCalledWith(2, 'Retry folder');
  });
});
