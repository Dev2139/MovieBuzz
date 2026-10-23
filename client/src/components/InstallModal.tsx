import React, { useState } from 'react';
import { usePWA } from '../context/PWAContext';
import {
  X,
  Smartphone,
  Download,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Sliders,
  QrCode,
  ExternalLink,
  Info,
} from 'lucide-react';

export const InstallModal: React.FC = () => {
  const { showInstallModal, setShowInstallModal, downloadApk, apkDownloadUrl } = usePWA();
  const [showQr, setShowQr] = useState(false);

  if (!showInstallModal) return null;

  // Build full APK URL for QR code
  const fullApkUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${apkDownloadUrl}`
    : 'https://moviebuzz.vercel.app/moviebuzz.apk';

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(fullApkUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-lg bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background effect */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => setShowInstallModal(false)}
          className="absolute top-5 right-5 p-2 text-gray-400 hover:text-white rounded-full hover:bg-dark-surface/80 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* App Logo & Header */}
        <div className="flex items-center space-x-3.5 mb-5">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-brand-500 via-red-600 to-amber-600 p-0.5 shadow-xl shadow-brand-500/25 flex-shrink-0">
            <div className="w-full h-full bg-dark-card rounded-2xl flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-brand-500" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-white tracking-wide">
                MovieBuzz for Android
              </h3>
              <span className="text-[10px] bg-brand-500/20 text-brand-400 font-extrabold px-2 py-0.5 rounded-full border border-brand-500/30">
                FLUTTER
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Direct Native App (APK) • Universal Build • 55 MB
            </p>
          </div>
        </div>

        {/* Highlight Perks Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-6">
          <div className="bg-dark-surface/70 border border-dark-border/80 rounded-xl p-3 flex items-start space-x-2.5">
            <Sliders className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-white">MX-Player Gestures</p>
              <p className="text-[11px] text-gray-400 leading-tight mt-0.5">Double-tap 10s seek, swipe brightness & volume</p>
            </div>
          </div>
          <div className="bg-dark-surface/70 border border-dark-border/80 rounded-xl p-3 flex items-start space-x-2.5">
            <Zap className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-white">Edge CDN Acceleration</p>
              <p className="text-[11px] text-gray-400 leading-tight mt-0.5">Cloudflare HLS streaming with instant start</p>
            </div>
          </div>
          <div className="bg-dark-surface/70 border border-dark-border/80 rounded-xl p-3 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-white">True Native Flutter</p>
              <p className="text-[11px] text-gray-400 leading-tight mt-0.5">Zero browser lag, smooth 120Hz rendering</p>
            </div>
          </div>
          <div className="bg-dark-surface/70 border border-dark-border/80 rounded-xl p-3 flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-white">Safe & Direct</p>
              <p className="text-[11px] text-gray-400 leading-tight mt-0.5">No Play Store account or login required</p>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => {
              downloadApk();
            }}
            className="w-full flex items-center justify-center space-x-2.5 py-3.5 bg-gradient-to-r from-brand-500 via-red-600 to-amber-600 hover:from-brand-600 hover:to-red-700 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-brand-500/30 transition-all transform hover:scale-[1.01] active:scale-[0.98]"
          >
            <Download className="w-5 h-5" />
            <span>Download Android App (.APK) — 55 MB</span>
          </button>

          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => setShowQr(!showQr)}
              className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <QrCode className="w-4 h-4 text-brand-400" />
              <span>{showQr ? 'Hide Mobile QR Code' : 'Scan QR code with your phone'}</span>
            </button>

            <a
              href={apkDownloadUrl}
              download="moviebuzz.apk"
              className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <span>Direct Link</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Scan QR Code Section (Collapsible) */}
        {showQr && (
          <div className="bg-dark-surface/90 border border-dark-border rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left animate-fade-in">
            <div className="bg-white p-2 rounded-xl shadow-md flex-shrink-0">
              <img
                src={qrImageUrl}
                alt="Scan QR code to download MovieBuzz APK"
                className="w-28 h-28"
              />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Scan from Phone Camera</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Point your Android camera at the QR code to instantly start the direct APK download on your device.
              </p>
            </div>
          </div>
        )}

        {/* 3-Step Simple Installation Guide */}
        <div className="bg-dark-surface/60 border border-dark-border/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-200">
            <Info className="w-4 h-4 text-brand-400" />
            <span>How to install in 3 easy steps</span>
          </div>

          <ol className="text-xs text-gray-300 space-y-2 pl-1">
            <li className="flex items-start space-x-2.5">
              <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5">
                1
              </span>
              <span>Tap <strong className="text-white">Download APK</strong> above to download the <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">moviebuzz.apk</code> file.</span>
            </li>
            <li className="flex items-start space-x-2.5">
              <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5">
                2
              </span>
              <span>Open the downloaded file from your browser notifications or <strong className="text-white">Files / Downloads</strong> app.</span>
            </li>
            <li className="flex items-start space-x-2.5">
              <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5">
                3
              </span>
              <span>Tap <strong className="text-white">Install</strong>. If Android asks for permission, toggle <strong className="text-white">"Allow from this source"</strong> and install!</span>
            </li>
          </ol>
        </div>

        {/* Footer */}
        <div className="mt-5 text-center">
          <button
            onClick={() => setShowInstallModal(false)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
