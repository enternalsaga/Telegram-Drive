import { open } from '@tauri-apps/plugin-dialog';
import { pickWithFallback, showFileDialogFallback } from '../utils';

const separatorFor = (path: string) => (path.includes('\\') ? '\\' : '/');

/** Parent directory of a file path, using whichever separator the path already uses. */
export const directoryFromPath = (path: string) => {
    const separator = separatorFor(path);
    const index = path.lastIndexOf(separator);
    return index > 0 ? path.slice(0, index) : path;
};

/** Joins a directory and a filename without doubling the trailing separator. */
export const joinPath = (directory: string, filename: string) => {
    const separator = separatorFor(directory);
    return directory.endsWith(separator) ? `${directory}${filename}` : `${directory}${separator}${filename}`;
};

/**
 * The browser folder picker returns individual file paths; the destination is the
 * directory of the first one (the path is cut at its last separator, as before).
 */
export const directoryOfFirstPickedPath = (paths: string[]): string | null => {
    if (paths.length === 0) return null;
    return paths[0].substring(0, paths[0].lastIndexOf(separatorFor(paths[0])));
};

/** Asks for a download destination folder, falling back to the browser picker; `retry` re-runs the flow. */
export const pickDownloadDirectory = (retry: () => Promise<unknown>) => pickWithFallback(
    () => open({ directory: true, multiple: false, title: "Select Download Destination" }),
    retry,
    {
        errorTitle: 'Folder picker failed',
        onBrowserPicker: async () => {
            const paths = await showFileDialogFallback({ directory: true, multiple: false });
            return directoryOfFirstPickedPath(paths);
        },
    },
);
