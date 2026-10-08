import React from 'react';
import { usePWA } from '../context/PWAContext';
import { X, Smartphone, Monitor, Share2, PlusSquare, CheckCircle2, Film, Zap, Download } from 'lucide-react';

export const InstallModal: React.FC = () => {
  const { showInstallModal, setShowInstallModal, isIOS, deferredPrompt, promptInstall } = usePWA();

  if (!showInstallModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-md bg-dark-card border border-dark-border rounded-2xl p-6 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient effect */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => setShowInstallModal(false)}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full hover:bg-dark-surface transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* App Logo & Title */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-red-700 flex items-center justify-center text-white shadow-lg shadow-brand-500/30">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
              Install MovieBuzz App
            </h3>
            <p className="text-xs text-gray-400">Stream on mobile or desktop like a native app</p>
          </div>
        </div>

        {/* Benefits list */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="bg-dark-surface/60 border border-dark-border/50 rounded-xl p-2.5 flex items-center space-x-2">
            <Zap className="w-4 h-4 text-brand-500 flex-shrink-0" />
            <span className="text-xs text-gray-200 font-medium">Instant Launch</span>
          </div>
          <div className="bg-dark-surface/60 border border-dark-border/50 rounded-xl p-2.5 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="text-xs text-gray-200 font-medium">Full-Screen Mode</span>
          </div>
        </div>

        {/* Device-Specific Instructions */}
        {deferredPrompt ? (
          <div className="space-y-4">
            <p className="text-xs text-gray-300">
              Click below to install MovieBuzz directly to your home screen or desktop application list.
            </p>
            <button
              onClick={() => {
                promptInstall();
              }}
              className="w-full flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-brand-500 to-red-600 hover:from-brand-600 hover:to-red-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              <span>Install to Device Now</span>
            </button>
          </div>
        ) : isIOS ? (
          <div className="space-y-3 bg-dark-surface/70 border border-dark-border rounded-xl p-4">
            <div className="flex items-center space-x-2 text-brand-400 font-semibold text-xs pb-1 border-b border-dark-border/60">
              <Smartphone className="w-4 h-4" />
              <span>Install on iPhone / iPad (Safari)</span>
            </div>
            <ol className="text-xs text-gray-300 space-y-2.5 pt-1">
              <li className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-dark-card border border-dark-border text-center text-[11px] font-bold text-brand-400 flex-shrink-0">
                  1
                </span>
                <span>
                  Tap the <strong className="text-white">Share</strong> button <Share2 className="inline w-3.5 h-3.5 text-blue-400 ml-0.5" /> in Safari’s navigation bar.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-dark-card border border-dark-border text-center text-[11px] font-bold text-brand-400 flex-shrink-0">
                  2
                </span>
                <span>
                  Scroll down the menu and tap <strong className="text-white">Add to Home Screen</strong> <PlusSquare className="inline w-3.5 h-3.5 text-gray-300 ml-0.5" />.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-5 h-5 rounded-full bg-dark-card border border-dark-border text-center text-[11px] font-bold text-brand-400 flex-shrink-0">
                  3
                </span>
                <span>
                  Tap <strong className="text-white">Add</strong> in the top right corner. MovieBuzz is now ready!
                </span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="space-y-3 bg-dark-surface/70 border border-dark-border rounded-xl p-4">
            <div className="flex items-center space-x-2 text-brand-400 font-semibold text-xs pb-1 border-b border-dark-border/60">
              <Monitor className="w-4 h-4" />
              <span>Desktop / Android Browser</span>
            </div>
            <p className="text-xs text-gray-300">
              Look for the <strong className="text-white">Install Icon</strong> (⊕ or ⬇) located in your browser's address bar next to the URL, or:
            </p>
            <ol className="text-xs text-gray-400 space-y-1.5 list-decimal pl-4">
              <li>Click your browser’s menu (<strong className="text-white">⋮</strong> or <strong className="text-white">⋯</strong>).</li>
              <li>Select <strong className="text-white">"Install MovieBuzz"</strong> or <strong className="text-white">"Add to Home screen"</strong>.</li>
            </ol>
          </div>
        )}

        <div className="mt-5 text-center">
          <button
            onClick={() => setShowInstallModal(false)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};
