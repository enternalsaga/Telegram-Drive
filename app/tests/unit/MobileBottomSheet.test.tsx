import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MobileBottomSheet } from '../../src/components/mobile/MobileBottomSheet';

describe('MobileBottomSheet', () => {
  it('exposes an accessible dialog, closes once with Escape, traps focus, and restores focus', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return <>
        <button type="button" onClick={() => setOpen(true)}>Open sheet</button>
        {open && <MobileBottomSheet title="Actions" onClose={() => { close(); setOpen(false); }}>
          <button type="button">Rename</button>
          <button type="button">Delete</button>
        </MobileBottomSheet>}
      </>;
    }
    render(<Harness />);

    const opener = screen.getByRole('button', { name: 'Open sheet' });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: 'Actions' }).getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename' }));
    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  it('keeps safe-area calc expressions valid in generated Tailwind classes', () => {
    render(<MobileBottomSheet title="Actions" onClose={vi.fn()}><button type="button">Rename</button></MobileBottomSheet>);

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-h-[calc(100dvh_-_env(safe-area-inset-top))]');
    expect(dialog.className).toContain('pb-[calc(2rem_+_env(safe-area-inset-bottom,0px))]');
  });
});
