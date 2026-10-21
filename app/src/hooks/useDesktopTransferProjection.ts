import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import type { Store } from '@tauri-apps/plugin-store';
import { isAndroidPlatform } from '../utils';
import {
    listenToDesktopTransfers,
    listDesktopTransfers,
    type DesktopTransferJob,
    type TransferDirection,
} from '../services/desktopTransferEngine';

type QueueSetter<T> = Dispatch<SetStateAction<T[]>>;

interface DesktopTransferProjectionOptions<T extends { id: string }> {
    direction: TransferDirection;
    /** Prefix for console diagnostics, e.g. `[Download]`. */
    logLabel: string;
    setQueue: QueueSetter<T>;
    toItem: (job: DesktopTransferJob) => T;
    /** Called when a live (not initial-load) event changes a job's status. */
    onTransition: (job: DesktopTransferJob) => void;
}

/**
 * Keeps a React queue in sync with the durable Rust desktop transfer engine.
 * Jobs carry a revision; stale events are ignored so ordering is deterministic.
 * Returns `mergeEnqueuedJobs` to fold the response of an enqueue call into the
 * queue using the same revision rules.
 */
export function useDesktopTransferProjection<T extends { id: string }>(
    options: DesktopTransferProjectionOptions<T>,
) {
    const revisionsRef = useRef<Map<string, number>>(new Map());
    const statusesRef = useRef<Map<string, string>>(new Map());
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const { direction } = options;

    useEffect(() => {
        if (isAndroidPlatform) return;
        let disposed = false;
        let unlisten: UnlistenFn | undefined;
        const accept = (job: DesktopTransferJob, notifyTransition = false) => {
            if (disposed || job.direction !== direction) return;
            const knownRevision = revisionsRef.current.get(job.id) || 0;
            if (job.revision < knownRevision) return;
            const previousStatus = statusesRef.current.get(job.id);
            revisionsRef.current.set(job.id, job.revision);
            statusesRef.current.set(job.id, job.status);
            const item = optionsRef.current.toItem(job);
            optionsRef.current.setQueue(queue => queue.some(candidate => candidate.id === item.id)
                ? queue.map(candidate => candidate.id === item.id ? item : candidate)
                : [...queue, item]);
            if (notifyTransition && previousStatus !== job.status) optionsRef.current.onTransition(job);
        };
        void listenToDesktopTransfers(job => accept(job, true), id => {
            revisionsRef.current.delete(id);
            statusesRef.current.delete(id);
            optionsRef.current.setQueue(queue => queue.filter(item => item.id !== id));
        }).then(async listener => {
            if (disposed) {
                listener();
                return;
            }
            unlisten = listener;
            const jobs = await listDesktopTransfers();
            jobs.forEach(job => accept(job));
        }).catch(error => {
            console.error(`${optionsRef.current.logLabel} Could not attach to the desktop transfer engine:`, error);
            toast.error('The desktop transfer queue could not be loaded.');
        });
        return () => {
            disposed = true;
            unlisten?.();
        };
    }, [direction]);

    const mergeEnqueuedJobs = (jobs: DesktopTransferJob[]) => {
        optionsRef.current.setQueue(previous => {
            const currentJobs = jobs.filter(job => job.revision >= (revisionsRef.current.get(job.id) || 0));
            const incoming = new Map(currentJobs.map(job => [job.id, optionsRef.current.toItem(job)]));
            const next = previous.map(item => incoming.get(item.id) || item);
            const known = new Set(previous.map(item => item.id));
            for (const job of currentJobs) {
                revisionsRef.current.set(job.id, job.revision);
                if (!known.has(job.id)) next.push(optionsRef.current.toItem(job));
            }
            return next;
        });
    };

    return { mergeEnqueuedJobs };
}

interface AndroidProgressPayload {
    id: string;
    percent: number;
    uploaded_bytes: number;
    total_bytes: number;
    speed_bytes_per_sec: number;
}

/** Android only: applies `<event>` progress payloads from Rust to the matching queue item. */
export function useAndroidTransferProgress<T extends { id: string }>(
    eventName: string,
    bytesField: 'downloadedBytes' | 'uploadedBytes',
    setQueue: QueueSetter<T>,
) {
    useEffect(() => {
        if (!isAndroidPlatform) return;
        let unlisten: UnlistenFn | undefined;
        listen<AndroidProgressPayload>(eventName, (event) => {
            setQueue(q => q.map(i =>
                i.id === event.payload.id ? {
                    ...i,
                    progress: event.payload.percent,
                    [bytesField]: event.payload.uploaded_bytes,
                    totalBytes: event.payload.total_bytes,
                    speedBytesPerSec: event.payload.speed_bytes_per_sec,
                } : i
            ));
        }).then(fn => { unlisten = fn; });
        return () => { unlisten?.(); };
    }, [eventName, bytesField, setQueue]);
}

/** Serialises writes of the Android recovery queue; failures flip `healthyRef` instead of throwing. */
export function persistTransferQueue(
    chainRef: MutableRefObject<Promise<void>>,
    healthyRef: MutableRefObject<boolean>,
    store: Store,
    key: string,
    pending: unknown,
    logLabel: string,
) {
    chainRef.current = chainRef.current
        .catch(() => undefined)
        .then(async () => {
            await store.set(key, pending);
            await store.save();
            healthyRef.current = true;
        })
        .catch(error => {
            healthyRef.current = false;
            console.error(`${logLabel} Could not persist the recovery queue:`, error);
        });
}

interface AndroidNetworkGateOptions {
    /** Statuses that are running and must be cancelled when the network drops. */
    activeStatuses: readonly string[];
    /** Queued statuses that should wait for the network without a running transfer. */
    queuedStatuses: readonly string[];
    networkPausedRef: MutableRefObject<Set<string>>;
    waitingReason: string;
}

/** Android only: parks work as `waiting_for_network` when offline and requeues it when back online. */
export function applyAndroidNetworkAvailability<T extends { id: string; status: string; error?: string }>(
    setQueue: QueueSetter<T>,
    networkAvailable: boolean,
    { activeStatuses, queuedStatuses, networkPausedRef, waitingReason }: AndroidNetworkGateOptions,
) {
    if (!networkAvailable) {
        setQueue(queue => {
            let changed = false;
            const next = queue.map(item => {
                if (!queuedStatuses.includes(item.status) && !activeStatuses.includes(item.status)) return item;
                changed = true;
                if (activeStatuses.includes(item.status)) {
                    networkPausedRef.current.add(item.id);
                    void invoke('cmd_cancel_transfer', { transferId: item.id }).catch(() => undefined);
                }
                return { ...item, status: 'waiting_for_network', error: waitingReason } as T;
            });
            return changed ? next : queue;
        });
        return;
    }
    setQueue(queue => queue.some(item => item.status === 'waiting_for_network')
        ? queue.map(item => item.status === 'waiting_for_network'
            ? { ...item, status: 'pending', error: undefined } as T
            : item)
        : queue);
}
