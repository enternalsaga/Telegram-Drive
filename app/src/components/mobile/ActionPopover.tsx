import { useEffect } from 'react';
import { X } from 'lucide-react';
import i18n from '../../i18n';
import { MobileBottomSheet } from './MobileBottomSheet';
import { type RegisterMobileBackHandler } from '../../hooks/useMobileBackHandlers';

export interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

interface ActionPopoverProps {
  actions: ActionItem[];
  onClose: () => void;
  title?: string;
  registerBackHandler?: RegisterMobileBackHandler;
  backHandlerId?: string;
  backPriority?: number;
}

/**
 * A bottom-sheet-style action popover for mobile, replacing swipe-to-reveal.
 * Tapping a file's ⋮ button opens this popover with contextual actions.
 */
export function ActionPopover({ actions, onClose, title, registerBackHandler, backHandlerId = 'action-popover', backPriority = 100 }: ActionPopoverProps) {
  return (
    <MobileBottomSheet title={title ?? ''} onClose={onClose}>
      <MobileBackRegistration registerBackHandler={registerBackHandler} id={backHandlerId} priority={backPriority} onClose={onClose} />
      <div className="space-y-1.5">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                action.onClick();
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                action.destructive
                  ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20'
                  : 'bg-white/5 text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              {action.icon && <span className="flex-shrink-0">{action.icon}</span>}
          {action.label}
        </button>
      ))}
      </div>

        {/* Cancel button */}
      <button
        onClick={onClose}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm font-semibold text-telegram-subtext transition-all duration-200 active:scale-[0.98] hover:bg-white/10"
      >
        <X className="w-4 h-4" />
        {i18n.t("common.cancel")}
      </button>
    </MobileBottomSheet>
  );
}

function MobileBackRegistration({ registerBackHandler, id, priority, onClose }: { registerBackHandler?: RegisterMobileBackHandler; id: string; priority: number; onClose: () => void }) {
  useEffect(() => registerBackHandler?.(id, priority, onClose), [id, onClose, priority, registerBackHandler]);
  return null;
}
