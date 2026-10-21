import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesktopTransferProjection } from '../../src/hooks/useDesktopTransferProjection';
import type { DesktopTransferJob } from '../../src/services/desktopTransferEngine';

const engine = vi.hoisted(() => ({
    upsert: undefined as ((job: unknown) => void) | undefined,
    remove: undefined as ((id: string) => void) | undefined,
    listed: [] as unknown[],
}));

vi.mock('../../src/services/desktopTransferEngine', () => ({
    listenToDesktopTransfers: vi.fn(async (onUpsert: (job: unknown) => void, onRemove: (id: string) => void) => {
        engine.upsert = onUpsert;
        engine.remove = onRemove;
        return () => undefined;
    }),
    listDesktopTransfers: vi.fn(async () => engine.listed),
}));

interface Item { id: string; status: string; revision: number }

const job = (id: string, revision: number, status = 'running', direction = 'download'): DesktopTransferJob => ({
    id, revision, status, direction, filename: id,
} as unknown as DesktopTransferJob);

const toItem = (j: DesktopTransferJob): Item => ({ id: j.id, status: j.status, revision: j.revision });

const setup = (onTransition = vi.fn()) => {
    const hook = renderHook(() => {
        const [queue, setQueue] = useState<Item[]>([]);
        const projection = useDesktopTransferProjection<Item>({
            direction: 'download', logLabel: '[Test]', setQueue, toItem, onTransition,
        });
        return { queue, ...projection };
    });
    return { hook, onTransition };
};

describe('useDesktopTransferProjection', () => {
    beforeEach(() => {
        engine.upsert = undefined;
        engine.remove = undefined;
        engine.listed = [];
    });

    it('loads the initial list without notifying transitions', async () => {
        engine.listed = [job('a', 1), job('b', 1, 'running', 'upload')];
        const { hook, onTransition } = setup();
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });
        expect(hook.result.current.queue.map(item => item.id)).toEqual(['a']);
        expect(onTransition).not.toHaveBeenCalled();
    });

    it('ignores stale revisions and notifies only on status change', async () => {
        const { hook, onTransition } = setup();
        await act(async () => { await Promise.resolve(); });
        act(() => engine.upsert?.(job('a', 5, 'running')));
        act(() => engine.upsert?.(job('a', 4, 'failed')));
        expect(hook.result.current.queue).toEqual([{ id: 'a', status: 'running', revision: 5 }]);
        act(() => engine.upsert?.(job('a', 6, 'running')));
        expect(onTransition).toHaveBeenCalledTimes(1);
        act(() => engine.upsert?.(job('a', 7, 'completed')));
        expect(onTransition).toHaveBeenCalledTimes(2);
        expect(hook.result.current.queue[0].status).toBe('completed');
    });

    it('removes items and forgets their revision', async () => {
        const { hook } = setup();
        await act(async () => { await Promise.resolve(); });
        act(() => engine.upsert?.(job('a', 5)));
        act(() => engine.remove?.('a'));
        expect(hook.result.current.queue).toEqual([]);
        act(() => engine.upsert?.(job('a', 1)));
        expect(hook.result.current.queue).toHaveLength(1);
    });

    it('merges enqueue responses using the same revision rules', async () => {
        const { hook } = setup();
        await act(async () => { await Promise.resolve(); });
        act(() => engine.upsert?.(job('a', 5, 'completed')));
        act(() => hook.result.current.mergeEnqueuedJobs([job('a', 3, 'pending'), job('b', 1, 'pending')]));
        expect(hook.result.current.queue).toEqual([
            { id: 'a', status: 'completed', revision: 5 },
            { id: 'b', status: 'pending', revision: 1 },
        ]);
    });
});
