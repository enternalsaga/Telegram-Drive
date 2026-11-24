import { useCallback, useEffect, useRef } from 'react';

declare global {
  interface Window {
    __telegramDriveHandleAndroidBack?: () => boolean;
  }
}

export type RegisterMobileBackHandler = (id: string, priority: number, close: () => void) => () => void;

interface BackHandler {
  priority: number;
  close: () => void;
}

/**
 * Owns the single Android-back entry point and lets transient mobile UI
 * register close callbacks in the order that users see overlays.
 */
export function useMobileBackHandlers(enabled: boolean) {
  const handlersRef = useRef(new Map<string, BackHandler>());

  const registerBackHandler = useCallback<RegisterMobileBackHandler>((id, priority, close) => {
    const handler = { priority, close };
    handlersRef.current.set(id, handler);
    return () => {
      if (handlersRef.current.get(id) === handler) handlersRef.current.delete(id);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const handleBack = () => {
      const next = Array.from(handlersRef.current.values())
        .sort((left, right) => right.priority - left.priority)[0];
      if (!next) return false;
      next.close();
      return true;
    };
    window.__telegramDriveHandleAndroidBack = handleBack;
    return () => {
      if (window.__telegramDriveHandleAndroidBack === handleBack) {
        delete window.__telegramDriveHandleAndroidBack;
      }
    };
  }, [enabled]);

  return { registerBackHandler };
}
