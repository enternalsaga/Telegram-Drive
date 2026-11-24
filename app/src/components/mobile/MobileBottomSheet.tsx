import { useRef, type ReactNode } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';

interface MobileBottomSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function MobileBottomSheet({ title, onClose, children }: MobileBottomSheetProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = 'mobile-bottom-sheet-title';
  useModalFocus(sheetRef, onClose);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === backdropRef.current) onClose();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[calc(100dvh_-_env(safe-area-inset-top))] w-full min-w-0 max-w-lg overflow-y-auto break-words rounded-t-3xl border border-telegram-border/40 bg-telegram-surface p-5 pb-[calc(2rem_+_env(safe-area-inset-bottom,0px))] shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-telegram-border/60" />
        </div>
        <h2 id={titleId} className="mb-4 break-words px-1 text-sm font-bold text-telegram-text">{title}</h2>
        {children}
      </div>
    </div>
  );
}
