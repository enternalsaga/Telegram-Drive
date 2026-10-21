import { useTranslation } from 'react-i18next';
import { RenameDialog } from './RenameDialog';

interface RenameFileModalProps {
    fileName: string;
    onRename: (newName: string) => Promise<void>;
    onClose: () => void;
}

export function RenameFileModal({ fileName, onRename, onClose }: RenameFileModalProps) {
    const { t } = useTranslation();
    return (
        <RenameDialog
            title={t('files.rename_file')}
            placeholder={t('files.file_name')}
            maxLength={200}
            currentName={fileName}
            onSubmit={onRename}
            onClose={onClose}
        />
    );
}
