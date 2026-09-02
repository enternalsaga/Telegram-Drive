// Containers the app's WebView (Chromium on Windows/Linux/Android, WebKit on macOS)
// decodes natively, so `<img>` / `<video>` can show them straight from the stream.
const RENDERABLE_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'jfif', 'png', 'apng', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico'] as const;
// Image containers Telegram commonly stores that no WebView decodes. They still
// route to the image viewer, which falls back to the Telegram thumbnail.
const UNRENDERABLE_IMAGE_EXTENSIONS = ['heic', 'heif', 'tif', 'tiff'] as const;
const IMAGE_EXTENSIONS = [...RENDERABLE_IMAGE_EXTENSIONS, ...UNRENDERABLE_IMAGE_EXTENSIONS] as const;

const PLAYABLE_VIDEO_EXTENSIONS = ['mp4', 'm4v', 'webm', 'ogv', 'ogg', 'mov', '3gp', '3g2'] as const;
// Containers no WebView demuxes. They route to the player, which explains the
// limitation instead of leaving a dead <video> element. `.ts` is deliberately
// absent: TypeScript sources are the likelier match for that extension.
const UNPLAYABLE_VIDEO_EXTENSIONS = ['mkv', 'avi', 'wmv', 'flv', 'mpg', 'mpeg', 'm2ts', 'rmvb'] as const;
const VIDEO_EXTENSIONS = [...PLAYABLE_VIDEO_EXTENSIONS, ...UNPLAYABLE_VIDEO_EXTENSIONS] as const;

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'aac', 'flac', 'm4a', 'opus', 'oga', 'weba'] as const;

// Telegram documents often carry a MIME type but an extension-less name, so the
// renderable/playable decision falls back to these.
const RENDERABLE_IMAGE_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/apng', 'image/gif', 'image/webp',
  'image/avif', 'image/bmp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon',
] as const;
const PLAYABLE_VIDEO_MIME_TYPES = [
  'video/mp4', 'video/x-m4v', 'video/webm', 'video/ogg', 'video/quicktime',
  'video/3gpp', 'video/3gpp2',
] as const;

const extensionOf = (name: string): string => {
  const lower = name.toLowerCase();
  const separator = lower.lastIndexOf('.');
  return separator > 0 ? lower.slice(separator + 1) : '';
};

const hasExtension = (name: string, extensions: readonly string[]): boolean =>
  extensions.includes(extensionOf(name));

const normalizeMimeType = (mimeType: string | null | undefined): string =>
  typeof mimeType === 'string' ? mimeType.trim().toLowerCase().split(';')[0] : '';

export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const base = 1024;
  const precision = decimals < 0 ? 0 : decimals;
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(base));
  return `${parseFloat((bytes / Math.pow(base, unitIndex)).toFixed(precision))} ${units[unitIndex]}`;
}

const hasMimePrefix = (mimeType: string | null | undefined, prefix: string): boolean =>
  normalizeMimeType(mimeType).startsWith(prefix);

// A recognized extension outranks the MIME type: Telegram reports
// application/octet-stream for many documents uploaded by other clients.
const supportsFormat = (
  name: string,
  mimeType: string | null | undefined,
  supported: readonly string[],
  unsupported: readonly string[],
  supportedMimeTypes: readonly string[],
): boolean => {
  const extension = extensionOf(name);
  if (supported.includes(extension)) return true;
  if (unsupported.includes(extension)) return false;
  return supportedMimeTypes.includes(normalizeMimeType(mimeType));
};

export const isVideoFile = (name: string, mimeType?: string | null): boolean =>
  hasExtension(name, VIDEO_EXTENSIONS) || hasMimePrefix(mimeType, 'video/');
export const isAudioFile = (name: string, mimeType?: string | null): boolean =>
  hasExtension(name, AUDIO_EXTENSIONS) || hasMimePrefix(mimeType, 'audio/');
export const isMediaFile = (name: string, mimeType?: string | null): boolean =>
  isVideoFile(name, mimeType) || isAudioFile(name, mimeType);
export const isImageFile = (name: string, mimeType?: string | null): boolean =>
  hasExtension(name, IMAGE_EXTENSIONS) || hasMimePrefix(mimeType, 'image/');

/** Whether `<img>` can decode this file, as opposed to needing the Telegram thumbnail. */
export const canRenderImageInApp = (name: string, mimeType?: string | null): boolean =>
  supportsFormat(name, mimeType, RENDERABLE_IMAGE_EXTENSIONS, UNRENDERABLE_IMAGE_EXTENSIONS, RENDERABLE_IMAGE_MIME_TYPES);

/** Whether `<video>` can demux and play this container without transcoding. */
export const canPlayVideoInApp = (name: string, mimeType?: string | null): boolean =>
  supportsFormat(name, mimeType, PLAYABLE_VIDEO_EXTENSIONS, UNPLAYABLE_VIDEO_EXTENSIONS, PLAYABLE_VIDEO_MIME_TYPES);

/**
 * Uppercase container label for messages, e.g. "MKV". Extension-less Telegram
 * documents fall back to the MIME subtype, so `video/x-matroska` reads
 * "MATROSKA" rather than leaving a gap in the sentence.
 */
export const fileFormatLabel = (name: string, mimeType?: string | null): string => {
  const extension = extensionOf(name);
  if (extension) return extension.toUpperCase();

  const subtype = normalizeMimeType(mimeType).split('/')[1] ?? '';
  return subtype.replace(/^(?:x-|vnd\.)/, '').toUpperCase();
};

export const isPdfFile = (name: string): boolean => name.toLowerCase().endsWith('.pdf');
export const isZipFile = (name: string): boolean => name.toLowerCase().endsWith('.zip');
export const isRarFile = (name: string): boolean => name.toLowerCase().endsWith('.rar');
export const isSevenZFile = (name: string): boolean => name.toLowerCase().endsWith('.7z');
export const isArchiveFile = (name: string): boolean => isZipFile(name) || isRarFile(name) || isSevenZFile(name);

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    || 'file';
}
