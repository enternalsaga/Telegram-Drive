import { Folder, MoreVertical, Check } from 'lucide-react';
import { TelegramFile } from '../../../types';
import { FileTypeIcon } from '../../shared/FileTypeIcon';
import { VideoMetaBadge } from '../../shared/VideoMetaBadge';
import { EncryptionBadge } from '../../shared/EncryptionBadge';
import { describeFileActions } from './fileActionDescriptors';
import { useFileItemInteractions } from './useFileItemInteractions';


interface FileListItemProps {
    file: TelegramFile;
    selectedIds: number[];
    onFileClick: (e: React.MouseEvent, file: TelegramFile) => void;
    handleContextMenu: (e: React.MouseEvent, file: TelegramFile) => void;
    disableDrag?: boolean;
}

export function FileListItem({
    file, selectedIds, onFileClick, handleContextMenu, disableDrag = false
}: FileListItemProps) {
    const { isFolder } = describeFileActions(file);
    const {
        attributes, listeners, setNodeRef, isDragging, isFileDragOver,
        videoMeta, videoMetaLoading, cachedQualities,
    } = useFileItemInteractions(file, isFolder, selectedIds, disableDrag);

    return (
        <div
            ref={setNodeRef}
            onClick={(e) => onFileClick(e, file)}
            onContextMenu={(e) => handleContextMenu(e, file)}
            style={{ opacity: isDragging ? 0.45 : undefined }}
            {...(!isFolder ? attributes : {})}
            {...(!isFolder ? listeners : {})}
            className={`group grid h-10 cursor-pointer grid-cols-[1.75rem_minmax(0,1fr)_2rem] items-center gap-3 border-b border-app-border-subtle px-3 transition-colors hover:bg-app-hover sm:grid-cols-[1.75rem_minmax(0,2fr)_6rem_8rem_2rem]
                ${selectedIds.includes(file.id) ? 'bg-app-selected' : ''}
                ${isFileDragOver ? 'bg-app-selected ring-2 ring-inset ring-app-accent' : ''}
            `}
        >
            <div className="flex justify-center">
                {isFolder ? <Folder className="h-4 w-4 text-app-accent" /> : <FileTypeIcon filename={file.name} className="h-4 w-4" />}
            </div>
            <div className="min-w-0 truncate text-ui font-medium text-app-text">
                <span>{file.name}</span>
                <EncryptionBadge state={file.encryption_state ?? 'plain'} className="ms-1.5 align-middle" />
                <VideoMetaBadge metadata={videoMeta} isLoading={videoMetaLoading} />
                {cachedQualities.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 ml-1.5">
                        {cachedQualities.map(q => (
                            <span key={q} className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1 py-0.5 text-badge font-medium text-emerald-400">
                                <Check className="w-2.5 h-2.5" />
                                {q}
                            </span>
                        ))}
                    </span>
                )}
            </div>
            <div className="hidden truncate text-end text-metadata text-app-text-secondary sm:block">{file.sizeStr}</div>
            <div className="hidden truncate text-end font-mono text-metadata text-app-text-tertiary sm:block">{file.created_at || '-'}</div>

            {/* 3-dot Menu Button — in grid flow, not absolutely positioned */}
            <div className="flex justify-end">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleContextMenu(e, file);
                    }}
                    className="quiet-control flex h-7 w-7 items-center justify-center border border-transparent text-app-text-secondary opacity-0 group-hover:opacity-100 hover:text-app-text focus-visible:opacity-100"
                    aria-label="File actions"
                >
                    <MoreVertical className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
