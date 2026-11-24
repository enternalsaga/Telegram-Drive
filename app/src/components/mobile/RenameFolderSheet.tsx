import { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MobileBottomSheet } from './MobileBottomSheet';
import { type RegisterMobileBackHandler } from '../../hooks/useMobileBackHandlers';

interface RenameFolderSheetProps {
    folderId: number;
    currentName: string;
    onRename: (folderId: number, oldName: string, newName: string) => Promise<void>;
    onClose: () => void;
    registerBackHandler?: RegisterMobileBackHandler;
}

export function RenameFolderSheet({ folderId, currentName, onRename, onClose, registerBackHandler }: RenameFolderSheetProps) {
    const [name, setName] = useState(currentName);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { t } = useTranslation();

    useEffect(() => registerBackHandler?.('rename-folder', 120, onClose), [onClose, registerBackHandler]);

    const handleSubmit = async () => {
        if (isSubmitting) return;
        const trimmed = name.trim();
        if (!trimmed || trimmed === currentName) {
            onClose();
            return;
        }
        setIsSubmitting(true);
        try {
            await onRename(folderId, currentName, trimmed);
            onClose();
        } catch {
            // error handled by parent
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <MobileBottomSheet title={t('files.rename_folder')} onClose={onClose}>
                <div className="mb-4 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-400/10 text-blue-400">
                        <Pencil className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs text-telegram-subtext mt-0.5">
                            {t('files.enter_new_name', { name: currentName })}
                        </p>
                    </div>
                </div>

                {/* Input */}
                <input
                    type="text"
                    data-modal-autofocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={100}
                    className="w-full bg-telegram-bg border border-telegram-border rounded-xl px-3.5 py-3 text-sm text-telegram-text placeholder:text-telegram-subtext/50 focus:outline-none focus:ring-2 focus:ring-telegram-primary/50 focus:border-telegram-primary/50 transition-all mb-4"
                    placeholder={t('files.folder_name')}
                    disabled={isSubmitting}
                />

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 text-sm font-semibold text-telegram-subtext hover:text-telegram-text bg-telegram-hover/30 hover:bg-telegram-hover/50 rounded-xl transition-colors active:scale-[0.98]"
                        disabled={isSubmitting}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !name.trim() || name.trim() === currentName}
                        className="flex-1 py-3 text-sm font-semibold text-white bg-telegram-primary hover:bg-telegram-primary/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors active:scale-[0.98]"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('files.renaming')}
                            </span>
                        ) : (
                            t('files.rename')
                        )}
                    </button>
                </div>
        </MobileBottomSheet>
    );
}
