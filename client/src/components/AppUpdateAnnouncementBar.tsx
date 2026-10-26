import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchLatestAppUpdateApi } from '../services/api';
import { usePWA } from '../context/PWAContext';
import { Sparkles, Download, X, ArrowRight, HardDriveDownload } from 'lucide-react';

export const AppUpdateAnnouncementBar: React.FC = () => {
  const location = useLocation();
  const { setShowInstallModal, downloadApk } = usePWA();
  const [dismissed, setDismissed] = useState(true);

  const { data: updateData } = useQuery({
    queryKey: ['latest-app-update'],
    queryFn: fetchLatestAppUpdateApi,
    staleTime: 5 * 60 * 1000,
  });

  const version = updateData?.version ? `v${updateData.version}` : 'v2.7.0';
  const storageKey = `moviebuzz_announcement_${version}_dismissed`;

  useEffect(() => {
    const isDismissed = localStorage.getItem(storageKey);
    if (!isDismissed) {
      setDismissed(false);
    }
  }, [storageKey]);

  if (dismissed || location.pathname.startsWith('/watch')) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(storageKey, 'true');
  };

  return (
    <aside 
      aria-label="App release announcement" 
      className="relative z-50 bg-gradient-to-r from-brand-950 via-dark-card to-amber-950/60 border-b border-brand-500/30 text-white text-xs sm:text-sm py-2 px-3 sm:px-6 shadow-lg shadow-black/40 backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          <span className="flex-shrink-0 inline-flex items-center gap-1 bg-brand-500/20 text-brand-400 font-extrabold text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-brand-500/40 animate-pulse">
            <Sparkles className="w-3 h-3" />
            {version} Live
          </span>
          <p className="truncate text-gray-200 text-xs sm:text-sm">
            <strong className="text-white font-semibold">New Release:</strong> Watch movies offline directly in our Android App! Direct playable MP4 source streaming enabled.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to="/download"
            className="hidden sm:inline-flex items-center gap-1.5 font-bold text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            <span>Learn More</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={() => {
              downloadApk();
            }}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-brand-500 to-red-600 hover:from-brand-600 hover:to-red-700 text-white font-bold text-xs px-3 py-1 sm:py-1.5 rounded-lg shadow-md shadow-brand-500/20 transition-all transform active:scale-95"
            title="Download MovieBuzz Android App"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install APK</span>
          </button>

          <button
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
