import { useTranslation } from 'react-i18next';
import { RenameDialog } from './RenameDialog';

interface RenameFolderModalProps {
    folderId: number;
    currentName: string;
    onRename: (folderId: number, oldName: string, newName: string) => Promise<void>;
    onClose: () => void;
}

export function RenameFolderModal({ folderId, currentName, onRename, onClose }: RenameFolderModalProps) {
    const { t } = useTranslation();
    return (
        <RenameDialog
            title={t('files.rename_folder')}
            placeholder={t('files.folder_name')}
            maxLength={100}
            currentName={currentName}
            hint={<div className="text-sm text-telegram-subtext">{t('files.enter_new_name', { name: currentName })}</div>}
            onSubmit={newName => onRename(folderId, currentName, newName)}
            onClose={onClose}
        />
    );
}
