import { describe, expect, it } from 'vitest';
import {
  canPlayVideoInApp,
  canRenderImageInApp,
  fileFormatLabel,
  formatBytes,
  isArchiveFile,
  isAudioFile,
  isImageFile,
  isMediaFile,
  isPdfFile,
  isVideoFile,
  sanitizeFilename,
} from '../../src/utils/files';
import { filterAndRankFiles, fuzzyScore, type FileSearchFilters } from '../../src/services/fileSearch';
import { classifyFileExtension, matchesSizeFacet } from '../../src/services/searchPolicy';
import { nextSortState, sortFiles } from '../../src/services/fileSort';
import { describeFileActions, resolvePublicFolderUsername } from '../../src/components/desktop/dashboard/fileActionDescriptors';
import type { TelegramFile, TelegramFolder } from '../../src/types';

describe('file utilities', () => {
  it('preserves current byte formatting boundaries', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536, 1)).toBe('1.5 KB');
  });

  it('classifies supported names case-insensitively', () => {
    expect(isImageFile('PHOTO.HEIC')).toBe(true);
    expect(isImageFile('holiday.WEBP')).toBe(true);
    expect(isImageFile('holiday.avif')).toBe(true);
    expect(isVideoFile('clip.MP4')).toBe(true);
    expect(isVideoFile('clip.WEBM')).toBe(true);
    expect(isAudioFile('voice.opus')).toBe(true);
    expect(isVideoFile('recording.bin', 'video/mp4')).toBe(true);
    expect(isAudioFile('recording.bin', 'audio/aac')).toBe(true);
    expect(isImageFile('sticker.bin', 'image/webp')).toBe(true);
    expect(isPdfFile('report.PDF')).toBe(true);
    expect(isArchiveFile('backup.7Z')).toBe(true);
  });

  it('matches on the trailing extension, not on any suffix of the name', () => {
    expect(isMediaFile('clipmp4')).toBe(false);
    expect(isVideoFile('notes')).toBe(false);
    expect(isImageFile('calico')).toBe(false);
    expect(isMediaFile('clipmp4', 'video/mp4')).toBe(true);
  });

  it('separates formats the WebView decodes from the ones it refuses', () => {
    expect(canRenderImageInApp('holiday.webp')).toBe(true);
    expect(canRenderImageInApp('holiday.avif')).toBe(true);
    expect(canRenderImageInApp('PHOTO.HEIC')).toBe(false);
    expect(canRenderImageInApp('scan.tiff')).toBe(false);
    expect(canPlayVideoInApp('clip.webm')).toBe(true);
    expect(canPlayVideoInApp('clip.mov')).toBe(true);
    expect(canPlayVideoInApp('clip.mkv')).toBe(false);
    expect(canPlayVideoInApp('clip.avi')).toBe(false);
  });

  it('prefers the extension over a generic Telegram MIME type', () => {
    expect(canPlayVideoInApp('clip.mkv', 'application/octet-stream')).toBe(false);
    expect(canPlayVideoInApp('clip.webm', 'application/octet-stream')).toBe(true);
    expect(canPlayVideoInApp('recording', 'video/webm')).toBe(true);
    expect(canRenderImageInApp('sticker', 'image/webp')).toBe(true);
    expect(canRenderImageInApp('sticker', 'image/heic')).toBe(false);
  });

  it('labels the container for user-facing messages', () => {
    expect(fileFormatLabel('clip.mkv')).toBe('MKV');
    expect(fileFormatLabel('PHOTO.HEIC')).toBe('HEIC');
    expect(fileFormatLabel('no-extension')).toBe('');
    expect(fileFormatLabel('no-extension', 'video/x-matroska')).toBe('MATROSKA');
    expect(fileFormatLabel('no-extension', 'image/heic')).toBe('HEIC');
    expect(fileFormatLabel('clip.mkv', 'video/mp4')).toBe('MKV');
  });

  it('sanitizes platform-reserved filename characters', () => {
    expect(sanitizeFilename(' ../bad:name?.txt ')).toBe('_bad_name_.txt');
    expect(sanitizeFilename('...')).toBe('file');
  });
});

describe('file action policy', () => {
  it('selects the existing preview behavior by file kind', () => {
    expect(describeFileActions({ name: 'Movies', type: 'folder' } as TelegramFile).previewAction).toBe('open');
    expect(describeFileActions({ name: 'clip.mp4' } as TelegramFile).previewAction).toBe('play');
    expect(describeFileActions({ name: 'report.pdf' } as TelegramFile).previewAction).toBe('view_pdf');
    expect(describeFileActions({ name: 'notes.txt' } as TelegramFile).previewAction).toBe('preview');
  });

  it('uses current and legacy public-folder usernames', () => {
    const file = { name: 'photo.jpg', folder_id: 7 } as TelegramFile;
    expect(resolvePublicFolderUsername(file, [{ id: 7, username: 'current' } as TelegramFolder], null)).toBe('current');
    expect(resolvePublicFolderUsername(file, [{ id: 7, channel: { username: 'legacy' } } as unknown as TelegramFolder], null)).toBe('legacy');
  });
});

describe('search policy', () => {
  const files: TelegramFile[] = [
    { id: 1, name: 'Holiday Photo.jpg', file_ext: 'jpg', size: 2_000, sizeStr: '2 KB', created_at: '2026-08-01T00:00:00Z' },
    { id: 2, name: 'Project Notes.pdf', file_ext: 'pdf', size: 20 * 1024 * 1024, sizeStr: '20 MB', created_at: '2025-01-01T00:00:00Z' },
  ];

  it('keeps fuzzy ranking deterministic', () => {
    expect(fuzzyScore('Project Notes.pdf', 'pnotes')).not.toBeNull();
    expect(fuzzyScore('Holiday Photo.jpg', 'xyz')).toBeNull();
  });

  it('uses exact size boundaries and extension groups', () => {
    expect(matchesSizeFacet(10 * 1024 * 1024 - 1, 'small')).toBe(true);
    expect(matchesSizeFacet(10 * 1024 * 1024, 'medium')).toBe(true);
    expect(matchesSizeFacet(100 * 1024 * 1024, 'large')).toBe(true);
    expect(classifyFileExtension('PDF')).toBe('document');
    expect(classifyFileExtension('unknown')).toBe('other');
  });

  it('filters and ranks without mutating the source array', () => {
    const filters: FileSearchFilters = { scope: 'folder', type: 'document', size: 'medium', date: 'any' };
    expect(filterAndRankFiles(files, 'notes', filters).map(file => file.id)).toEqual([2]);
    expect(files.map(file => file.id)).toEqual([1, 2]);
  });
});

describe('file sorting', () => {
  const unsorted: TelegramFile[] = [
    { id: 1, name: 'photo 10.jpg', size: 300, sizeStr: '300 B', created_at: '2026-01-03T00:00:00Z' },
    { id: 2, name: 'photo 2.jpg', size: 100, sizeStr: '100 B', created_at: '2026-01-01T00:00:00Z' },
    { id: 3, name: 'Photo 3.jpg', size: 200, sizeStr: '200 B', created_at: '2026-01-02T00:00:00Z' },
  ] as TelegramFile[];

  it('orders names the way a reader expects, not by code point', () => {
    // "photo 2" before "photo 10", and case does not split the group.
    expect(sortFiles(unsorted, 'name', 'asc', 'en').map(f => f.id)).toEqual([2, 3, 1]);
  });

  it('reverses every field on descending', () => {
    expect(sortFiles(unsorted, 'size', 'asc', 'en').map(f => f.id)).toEqual([2, 3, 1]);
    expect(sortFiles(unsorted, 'size', 'desc', 'en').map(f => f.id)).toEqual([1, 3, 2]);
    expect(sortFiles(unsorted, 'date', 'asc', 'en').map(f => f.id)).toEqual([2, 3, 1]);
    expect(sortFiles(unsorted, 'date', 'desc', 'en').map(f => f.id)).toEqual([1, 3, 2]);
  });

  it('leaves the caller list untouched', () => {
    sortFiles(unsorted, 'size', 'desc', 'en');
    expect(unsorted.map(f => f.id)).toEqual([1, 2, 3]);
  });

  it('flips direction on the active field and restarts ascending on a new one', () => {
    expect(nextSortState({ field: 'name', direction: 'asc' }, 'name')).toEqual({ field: 'name', direction: 'desc' });
    expect(nextSortState({ field: 'name', direction: 'desc' }, 'name')).toEqual({ field: 'name', direction: 'asc' });
    expect(nextSortState({ field: 'name', direction: 'desc' }, 'size')).toEqual({ field: 'size', direction: 'asc' });
  });
});
