import { lazy } from 'react';
import { Link, X, Loader2, Check, Copy, Share2 } from 'lucide-react';
import type { TelegramFile, TelegramFolder, Settings } from '../../types';
import type { useSettings } from '../../context/SettingsContext';
import type { SupporterPromptTrigger } from '../../services/supporterVisibility';
import { LazyFeatureBoundary } from '../shared/LazyFeatureBoundary';
import { ShareDialog } from '../desktop/dashboard/ShareDialog';
import { DriveConceptTour } from '../desktop/dashboard/DriveConceptTour';
import { SupporterOfferDialog } from '../shared/SupporterOfferDialog';
import i18n from '../../i18n';

const LazyHelpCenterDialog = lazy(() => import('../desktop/dashboard/HelpCenterDialog').then((module) => ({ default: module.HelpCenterDialog })));
const LazyMobileMediaPlayer = lazy(() => import('./MobileMediaPlayer').then((module) => ({ default: module.MobileMediaPlayer })));
const LazyPdfViewer = lazy(() => import('../desktop/dashboard/PdfViewer').then((module) => ({ default: module.PdfViewer })));
const LazyPreviewModal = lazy(() => import('../desktop/dashboard/PreviewModal').then((module) => ({ default: module.PreviewModal })));

interface MobileDashboardOverlaysProps {
  playingFile: TelegramFile | null;
  setPlayingFile: (file: TelegramFile | null) => void;
  pdfFile: TelegramFile | null;
  setPdfFile: (file: TelegramFile | null) => void;
  previewFile: TelegramFile | null;
  setPreviewFile: (file: TelegramFile | null) => void;
  shareFile: TelegramFile | null;
  setShareFile: (file: TelegramFile | null) => void;
  activeFolderId: number | null;
  settings: Settings;
  settingsLoaded: boolean;
  updateSetting: ReturnType<typeof useSettings>['updateSetting'];
  handleDownload: (file: TelegramFile) => void;
  previewImages: TelegramFile[];
  previewIndex: number;
  stepPreview: (step: 1 | -1) => void;
  folders: TelegramFolder[];
  showHelp: boolean;
  setShowHelp: (open: boolean) => void;
  supporterOfferTrigger: SupporterPromptTrigger | null;
  setSupporterOfferTrigger: (trigger: SupporterPromptTrigger | null) => void;
  isTelevision: boolean;
  openMobileSupporter: () => void;
  bulkShareLinks: Array<{ file: TelegramFile; link: string }> | null;
  setBulkShareLinks: (links: Array<{ file: TelegramFile; link: string }> | null) => void;
  bulkShareLoading: boolean;
  bulkShareCopied: Set<string>;
  handleCopyBulkLink: (link: string) => void;
  handleNativeShareBulkLink: (file: TelegramFile, link: string) => void;
}

export function MobileDashboardOverlays({ playingFile, setPlayingFile, pdfFile, setPdfFile, previewFile, setPreviewFile, shareFile, setShareFile, activeFolderId, settings, settingsLoaded, updateSetting, handleDownload, previewImages, previewIndex, stepPreview, folders, showHelp, setShowHelp, supporterOfferTrigger, setSupporterOfferTrigger, isTelevision, openMobileSupporter, bulkShareLinks, setBulkShareLinks, bulkShareLoading, bulkShareCopied, handleCopyBulkLink, handleNativeShareBulkLink }: MobileDashboardOverlaysProps) {
  return (
    <>
      {/* Previews Overlays (Media, PDF & Images) */}
      {playingFile && (
        <LazyFeatureBoundary>
          <LazyMobileMediaPlayer
            key={playingFile.id}
            file={playingFile}
            onClose={() => setPlayingFile(null)}
            activeFolderId={activeFolderId}
            preferences={{
              privateMetadata: settings.androidPrivateMediaMetadata,
              privacyScreen: settings.androidPrivacyScreen,
              orientation: settings.androidMediaOrientation,
              subtitleScale: settings.androidSubtitleScale,
              playbackSpeed: settings.androidPlaybackSpeed,
            }}
          />
        </LazyFeatureBoundary>
      )}
      {pdfFile && (
        <div className="fixed inset-0 z-[100] bg-telegram-bg">
          <LazyFeatureBoundary>
            <LazyPdfViewer
              file={pdfFile}
              onClose={() => setPdfFile(null)}
              activeFolderId={activeFolderId}
            />
          </LazyFeatureBoundary>
        </div>
      )}
      {previewFile && (
        <LazyFeatureBoundary>
          <LazyPreviewModal
            file={previewFile}
            activeFolderId={activeFolderId}
            onClose={() => setPreviewFile(null)}
            onDownload={handleDownload}
            onNext={previewImages.length > 1 ? () => stepPreview(1) : undefined}
            onPrev={previewImages.length > 1 ? () => stepPreview(-1) : undefined}
            currentIndex={previewIndex >= 0 ? previewIndex : undefined}
            totalItems={previewImages.length}
            nextFile={previewIndex >= 0 ? previewImages[(previewIndex + 1) % previewImages.length] ?? null : null}
            mobile
          />
        </LazyFeatureBoundary>
      )}

      {shareFile && (
        <ShareDialog
          file={shareFile}
          onClose={() => setShareFile(null)}
          folders={folders}
          activeFolderId={activeFolderId}
        />
      )}

      {settingsLoaded && !settings.driveTourSeen && (
        <DriveConceptTour
          onFinish={() => updateSetting('driveTourSeen', true)}
          onOpenHelp={() => { updateSetting('driveTourSeen', true); setShowHelp(true); }}
        />
      )}

      {showHelp && <LazyFeatureBoundary><LazyHelpCenterDialog onClose={() => setShowHelp(false)} /></LazyFeatureBoundary>}

      {supporterOfferTrigger && (
        <SupporterOfferDialog
          trigger={supporterOfferTrigger}
          presentation={isTelevision ? 'tv-dialog' : 'bottom-sheet'}
          onClose={() => setSupporterOfferTrigger(null)}
          onOpenSupporter={openMobileSupporter}
        />
      )}

      {/* Bulk Share Results Modal */}
      {bulkShareLinks && (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setBulkShareLinks(null)}
        >
          <div
            className="w-full max-w-lg bg-[#1c1c1e] border border-white/10 rounded-t-3xl p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Link className="w-4 h-4 text-telegram-primary" />
                {bulkShareLinks.length} {i18n.t("files.share_link")}{bulkShareLinks.length !== 1 ? 's' : ''}
              </h3>
              <button
                onClick={() => setBulkShareLinks(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-telegram-subtext"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bulkShareLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="w-8 h-8 text-telegram-primary animate-spin" />
                <p className="text-xs text-telegram-subtext">Generating share links...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {bulkShareLinks.map(({ file, link }) => {
                  const isCopied = bulkShareCopied.has(link);
                  return (
                    <div
                      key={file.id}
                      className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2"
                    >
                      <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={link}
                          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-telegram-subtext focus:outline-none select-all truncate"
                        />
                        <button
                          onClick={() => handleCopyBulkLink(link)}
                          className={`px-2.5 py-1.5 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${
                            isCopied
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'bg-white/10 border border-white/10 text-telegram-subtext hover:bg-white/20'
                          }`}
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                          <button
                            onClick={() => handleNativeShareBulkLink(file, link)}
                            className="px-2.5 py-1.5 rounded-lg bg-telegram-primary/20 hover:bg-telegram-primary/30 text-telegram-primary border border-telegram-primary/30 transition-all flex items-center justify-center flex-shrink-0"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setBulkShareLinks(null)}
              className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold bg-white/5 text-telegram-subtext hover:bg-white/10 border border-white/5 transition-all duration-200 active:scale-[0.98] flex-shrink-0"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
