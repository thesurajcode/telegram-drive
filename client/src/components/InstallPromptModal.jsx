import React, { useState, useEffect } from 'react';
import {
  Download,
  Share,
  PlusSquare,
  Sparkles,
  X,
  Smartphone,
  Check,
  HardDrive,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function InstallPromptModal({
  isOpen,
  onClose,
  deferredPrompt,
  onInstalled,
}) {
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if running on iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Check if already installed
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) {
      setIsInstalled(true);
    }
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        if (onInstalled) onInstalled();
        onClose();
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 16px, 16px)',
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className="relative w-full max-w-md max-h-[min(90vh,calc(100dvh-3rem))] overflow-y-auto my-auto bg-white dark:bg-[#0c101d] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl z-10 animate-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with App Icon */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-[1.5px] shadow-lg shadow-blue-500/25 shrink-0">
            <div className="w-full h-full bg-[#080c14] rounded-[14px] flex items-center justify-center text-white">
              <HardDrive className="w-7 h-7 text-blue-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-lg font-bold">Install TelePhotos App</h3>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Instant access & native full-screen experience
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 gap-2.5 mb-6 text-xs">
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Lightning Fast Launch</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">Opens instantly with cached app shell and zero URL bar clutter.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">Private MTProto Cloud</span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">Direct encrypted access to your Telegram files and media vault.</p>
            </div>
          </div>
        </div>

        {/* Installation Instructions / CTA */}
        {isInstalled ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            <span>TelePhotos is already installed on this device!</span>
          </div>
        ) : isIOS ? (
          /* iOS Step-by-Step Instructions */
          <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 text-xs flex flex-col gap-2.5">
            <p className="font-bold text-blue-700 dark:text-blue-300">How to install on iOS Safari:</p>
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
              <span>Tap the <Share className="w-3.5 h-3.5 inline mx-1 text-blue-500" /> <b>Share</b> button in Safari bottom bar</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
              <span>Scroll down & tap <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-blue-500" /> <b>Add to Home Screen</b></span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
              <span>Tap <b>Add</b> in the top right corner</span>
            </div>
          </div>
        ) : deferredPrompt ? (
          /* Android / Chrome One-Click Install Button */
          <button
            onClick={handleInstallClick}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Install App Now</span>
          </button>
        ) : (
          /* Browser Menu Fallback Instructions */
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 text-center">
            Tap your browser menu (<span className="font-bold">⋮</span>) and select <span className="font-bold text-blue-500">"Install TelePhotos"</span> or <span className="font-bold text-blue-500">"Add to Home Screen"</span>.
          </div>
        )}
      </div>
    </div>
  );
}
