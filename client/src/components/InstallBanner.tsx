import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePWA } from '../context/PWAContext';
import { Download, X, Smartphone, HelpCircle } from 'lucide-react';

export const InstallBanner: React.FC = () => {
  const { downloadApk, setShowInstallModal } = usePWA();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check if dismissed recently (24 hours)
    const lastDismissed = localStorage.getItem('moviebuzz_apk_banner_dismissed');
    if (lastDismissed) {
      const diffHours = (Date.now() - Number(lastDismissed)) / (1000 * 60 * 60);
      if (diffHours < 24) {
        setDismissed(true);
        return;
      }
    }
    setDismissed(false);
  }, []);

  // Hide on watch page or if dismissed
  if (dismissed || location.pathname.startsWith('/watch/')) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('moviebuzz_apk_banner_dismissed', String(Date.now()));
  };

  return (
    <div className="fixed bottom-16 md:bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-lg z-40 animate-slide-up">
      <div className="bg-dark-card/95 backdrop-blur-xl border border-dark-border/90 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white ring-1 ring-white/10">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 via-red-600 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/25">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">MovieBuzz Android App</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                FLUTTER APK
              </span>
            </div>
            <p className="text-xs text-gray-300 truncate mt-0.5">
              Direct install • Gesture controls, 4K streaming & offline mode
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-auto">
          <button
            onClick={() => {
              downloadApk();
            }}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-brand-500 to-red-600 hover:from-brand-600 hover:to-red-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-lg shadow-brand-500/30 transition-all transform active:scale-95"
            title="Download MovieBuzz Android APK (55 MB)"
          >
            <Download className="w-4 h-4" />
            <span>Download APK</span>
          </button>

          <button
            onClick={() => setShowInstallModal(true)}
            className="p-2 text-gray-300 hover:text-white rounded-xl hover:bg-dark-surface/80 border border-dark-border/80 transition-colors"
            title="Installation Guide"
            aria-label="Installation Guide"
          >
            <HelpCircle className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={handleDismiss}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-dark-surface/80 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
