import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePWA } from '../context/PWAContext';
import { fetchLatestAppUpdateApi } from '../services/api';
import { Download, X, HelpCircle, Sparkles } from 'lucide-react';

export const InstallBanner: React.FC = () => {
  const { downloadApk, setShowInstallModal, apkDownloadUrl } = usePWA();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(true);

  const { data: appUpdate } = useQuery({
    queryKey: ['latest-app-update'],
    queryFn: fetchLatestAppUpdateApi,
    staleTime: 5 * 60 * 1000,
  });

  const version = appUpdate?.version ? `v${appUpdate.version}` : 'v2.8.0';
  const apkSize = appUpdate?.apkSize || '54 MB';

  useEffect(() => {
    // Re-show when a new version is released, or after 24 hours
    const dismissedVersion = localStorage.getItem('moviebuzz_apk_banner_dismissed_version');
    const lastDismissed = localStorage.getItem('moviebuzz_apk_banner_dismissed');

    if (dismissedVersion === version && lastDismissed) {
      const diffHours = (Date.now() - Number(lastDismissed)) / (1000 * 60 * 60);
      if (diffHours < 24) {
        setDismissed(true);
        return;
      }
    }
    setDismissed(false);
  }, [version]);

  // Hide on watch page or if dismissed
  if (dismissed || location.pathname.startsWith('/watch/')) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('moviebuzz_apk_banner_dismissed', String(Date.now()));
    localStorage.setItem('moviebuzz_apk_banner_dismissed_version', version);
  };

  return (
    <div className="fixed bottom-16 md:bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-lg z-40 animate-slide-up">
      <div className="bg-dark-card/95 backdrop-blur-xl border border-dark-border/90 rounded-2xl p-3.5 sm:p-4 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white ring-1 ring-white/10">
        <div className="flex items-center space-x-3 overflow-hidden">
          <img
            src="/app-icon.png"
            alt="MovieBuzz App Icon"
            className="w-11 h-11 rounded-xl shadow-lg shadow-brand-500/25 object-cover flex-shrink-0 border border-white/10"
          />
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">Download Our Android App</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                {version}
              </span>
            </div>
            <p className="text-xs text-gray-300 truncate mt-0.5">
              Smart Offline Redirect • Zero-Data Playback ({apkSize})
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
