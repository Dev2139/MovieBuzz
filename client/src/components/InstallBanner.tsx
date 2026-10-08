import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePWA } from '../context/PWAContext';
import { Film, Download, X, Smartphone } from 'lucide-react';

export const InstallBanner: React.FC = () => {
  const { isInstalled, promptInstall } = usePWA();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check if dismissed recently (2 days)
    const lastDismissed = localStorage.getItem('moviebuzz_pwa_banner_dismissed');
    if (lastDismissed) {
      const diffHours = (Date.now() - Number(lastDismissed)) / (1000 * 60 * 60);
      if (diffHours < 48) {
        setDismissed(true);
        return;
      }
    }
    setDismissed(false);
  }, []);

  // Hide on watch page or if already running as installed app or dismissed
  if (isInstalled || dismissed || location.pathname.startsWith('/watch/')) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('moviebuzz_pwa_banner_dismissed', String(Date.now()));
  };

  return (
    <div className="fixed bottom-16 md:bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-md z-40 animate-slide-up">
      <div className="bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 text-white ring-1 ring-white/10">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-red-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-500/20">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white tracking-wide">MovieBuzz App</span>
              <span className="text-[10px] bg-brand-500/20 text-brand-400 font-semibold px-1.5 py-0.2 rounded">PWA</span>
            </div>
            <p className="text-[11px] text-gray-300 truncate">Install on your device for instant streaming</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={promptInstall}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-brand-500 to-red-600 hover:from-brand-600 hover:to-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg shadow-brand-500/30 transition-all transform active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-dark-surface transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
