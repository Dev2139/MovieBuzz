import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchLatestAppUpdateApi } from '../services/api';
import {
  Download,
  Smartphone,
  ShieldCheck,
  Zap,
  Film,
  Sparkles,
  QrCode,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  ExternalLink,
  Cpu,
  Layers,
  ArrowRight,
  Tv,
} from 'lucide-react';

export const DownloadAppPage: React.FC = () => {
  const [showQr, setShowQr] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const { data: updateData, isLoading } = useQuery({
    queryKey: ['latest-app-update'],
    queryFn: fetchLatestAppUpdateApi,
    staleTime: 5 * 60 * 1000,
  });

  const version = updateData?.version ? `v${updateData.version}` : 'v2.2.0';
  const apkSize = updateData?.apkSize || '55 MB';
  const downloadUrl = updateData?.downloadUrl || '/moviebuzz.apk';
  const changelog = updateData?.changelog || '';
  const updateTitle = updateData?.title || 'MovieBuzz v2.2.0 — Cinema Engine';

  // Construct absolute APK URL for QR code
  const absoluteApkUrl = typeof window !== 'undefined'
    ? (downloadUrl.startsWith('http')
        ? downloadUrl
        : `${window.location.origin}${downloadUrl}`)
    : 'https://moviebuzz.vercel.app/moviebuzz.apk';

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(absoluteApkUrl)}`;

  const faqs = [
    {
      q: 'Is this APK safe to install on my Android phone?',
      a: 'Yes, 100% safe. The MovieBuzz APK is compiled cleanly without ad trackers, bloatware, or spyware. When installing, Android may show a standard safety alert for apps downloaded from the web—simply tap "Allow from this source" or "Install Anyway".',
    },
    {
      q: 'Why install directly from our website instead of Google Play?',
      a: 'Distributing directly gives you unrestricted access to high-bitrate 4K edge streams, zero regional geoblocks, and instantaneous updates directly pushed from our servers without Google Play delays.',
    },
    {
      q: 'How will I receive future updates?',
      a: 'The MovieBuzz app includes a built-in update notifier. Whenever our admin team publishes a new version, you will get an in-app banner to upgrade effortlessly with a single tap.',
    },
    {
      q: 'Does it work on Android TV, FireStick, or tablets?',
      a: 'Yes! The APK contains universal native binaries (arm64-v8a and armeabi-v7a) supporting Android phones, tablets, Fire TV, and Android TV devices running Android 6.0 and higher.',
    },
  ];

  return (
    <div className="min-h-screen bg-dark-base text-white pt-24 pb-20 selection:bg-brand-500 selection:text-white">
      {/* Background Ambient Glow Orbs */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 pointer-events-none overflow-hidden z-0 opacity-40">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-600/30 rounded-full blur-[128px]" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-6 pt-6 sm:pt-10">
          {/* App Icon with Glow */}
          <div className="relative inline-block mx-auto group">
            <div className="absolute -inset-2 bg-gradient-to-r from-brand-500 via-amber-500 to-red-600 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition duration-500" />
            <img
              src="/app-icon.png"
              alt="MovieBuzz 3D Icon"
              className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-3xl shadow-2xl object-cover border-2 border-white/20 transform group-hover:scale-105 transition-transform duration-300"
            />
          </div>

          {/* Badges */}
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider bg-brand-500/15 text-brand-400 border border-brand-500/30 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              {version} Official Release
            </span>
            <span className="text-xs font-bold text-gray-300 bg-dark-card border border-dark-border px-3 py-1 rounded-full">
              Android 6.0+ • {apkSize}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified Safe
            </span>
          </div>

          {/* Main Title & Subtitle */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              Get <span className="bg-gradient-to-r from-white via-gray-100 to-brand-400 bg-clip-text text-transparent">MovieBuzz</span> for Android
            </h1>
            <p className="text-sm sm:text-base text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Experience silky-smooth 120Hz cinema playback, buffer-free edge streaming, picture-in-picture mode, and full offline gesture controls.
            </p>
          </div>

          {/* Primary Action Button & QR Toggle */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <a
              href={downloadUrl}
              download="moviebuzz.apk"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-500 via-red-600 to-amber-600 hover:from-brand-600 hover:to-red-700 text-white font-extrabold text-base rounded-2xl shadow-2xl shadow-brand-500/40 transform hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Download className="w-5 h-5 flex-shrink-0 animate-bounce" />
              <span>Download Android APK ({apkSize})</span>
            </a>

            <button
              onClick={() => setShowQr(!showQr)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-4 bg-dark-card hover:bg-dark-surface border border-dark-border text-gray-200 hover:text-white font-bold text-sm rounded-2xl transition-all"
            >
              <QrCode className="w-5 h-5 text-brand-400" />
              <span>{showQr ? 'Hide QR Code' : 'Scan Phone QR'}</span>
            </button>
          </div>

          {/* Secondary info note */}
          <p className="text-xs text-gray-500">
            Direct download link • No Google Play registration required
          </p>

          {/* Collapsible QR Code Card for Desktop Users */}
          {showQr && (
            <div className="max-w-md mx-auto bg-dark-card/90 backdrop-blur-xl border border-dark-border rounded-3xl p-6 shadow-2xl text-center space-y-3 animate-fade-in">
              <div className="inline-block bg-white p-3.5 rounded-2xl shadow-lg">
                <img
                  src={qrImageUrl}
                  alt="Scan QR code to install MovieBuzz"
                  className="w-44 h-44 mx-auto"
                />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-white">Scan to Install on Android</h2>
                <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                  Open your phone camera or QR scanner to instantly download <strong className="text-white">moviebuzz.apk</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* What's New in this Version Card */}
        {changelog && (
          <div className="max-w-3xl mx-auto bg-gradient-to-r from-brand-950/40 via-dark-card to-dark-card border border-brand-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-brand-500/20 text-brand-400 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white">{updateTitle}</h2>
                  <p className="text-xs text-gray-400">Release Notes & Changelog</p>
                </div>
              </div>
              <span className="text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 px-3 py-1 rounded-full">
                {version}
              </span>
            </div>

            <div className="text-xs sm:text-sm text-gray-200 leading-relaxed space-y-2 whitespace-pre-line font-mono pl-1">
              {changelog}
            </div>
          </div>
        )}

        {/* Feature Highlights Grid */}
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-4xl font-black text-white">
              Built for Ultimate Performance
            </h2>
            <p className="text-xs sm:text-sm text-gray-400">
              Why thousands of users stream movies and web series on our native Android app.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-dark-card border border-dark-border hover:border-brand-500/50 rounded-2xl p-6 space-y-3 transition-colors shadow-lg">
              <div className="p-3 bg-brand-500/10 text-brand-400 rounded-xl w-fit">
                <Film className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Cinema HD & Dolby Audio</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Stream movies and TV series in crisp 4K HDR with dynamic bitrate switching and multi-track audio options.
              </p>
            </div>

            <div className="bg-dark-card border border-dark-border hover:border-amber-500/50 rounded-2xl p-6 space-y-3 transition-colors shadow-lg">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl w-fit">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Edge CDN Acceleration</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Direct Cloudflare edge caching delivers near-instant video start times and eliminates buffering loops.
              </p>
            </div>

            <div className="bg-dark-card border border-dark-border hover:border-emerald-500/50 rounded-2xl p-6 space-y-3 transition-colors shadow-lg">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">120Hz Fluid Navigation</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Physics-based bouncy scrolling and in-memory image caching ensure smooth 120fps UI responsiveness.
              </p>
            </div>

            <div className="bg-dark-card border border-dark-border hover:border-blue-500/50 rounded-2xl p-6 space-y-3 transition-colors shadow-lg">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl w-fit">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Privacy & No Ads</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                No third-party trackers, popups, or intrusive banner ads. Straightforward, uninterrupted entertainment.
              </p>
            </div>

            <div className="bg-dark-card border border-dark-border hover:border-purple-500/50 rounded-2xl p-6 space-y-3 transition-colors shadow-lg">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Watch History & Watchlist</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Resume right where you left off across all your devices with real-time cloud watch progress synchronization.
              </p>
            </div>

            <div className="bg-dark-card border border-dark-border hover:border-rose-500/50 rounded-2xl p-6 space-y-3 transition-colors shadow-lg">
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl w-fit">
                <Tv className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Android TV & Tablet Ready</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Responsive layouts designed to look stunning on phones, phablets, tablets, and smart televisions.
              </p>
            </div>
          </div>
        </div>

        {/* 3-Step Simple Installation Guide */}
        <div className="max-w-4xl mx-auto bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              How to Install in 3 Easy Steps
            </h2>
            <p className="text-xs sm:text-sm text-gray-400">
              Quick guide for installing the APK on any Android phone or tablet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-dark-surface border border-dark-border/80 rounded-2xl p-6 space-y-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-2xl bg-brand-500 text-white font-black text-lg flex items-center justify-center mx-auto sm:mx-0 shadow-lg shadow-brand-500/30">
                1
              </div>
              <h3 className="text-base font-bold text-white">Download the APK</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Click the <strong className="text-white">Download APK</strong> button. Your browser will save <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">moviebuzz.apk</code> to your device.
              </p>
            </div>

            <div className="bg-dark-surface border border-dark-border/80 rounded-2xl p-6 space-y-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-2xl bg-brand-500 text-white font-black text-lg flex items-center justify-center mx-auto sm:mx-0 shadow-lg shadow-brand-500/30">
                2
              </div>
              <h3 className="text-base font-bold text-white">Open the File</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Tap the downloaded notification in your notification drawer, or find it in your phone's <strong className="text-white">Files / Downloads</strong> app.
              </p>
            </div>

            <div className="bg-dark-surface border border-dark-border/80 rounded-2xl p-6 space-y-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-2xl bg-brand-500 text-white font-black text-lg flex items-center justify-center mx-auto sm:mx-0 shadow-lg shadow-brand-500/30">
                3
              </div>
              <h3 className="text-base font-bold text-white">Allow & Install</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                If prompted by Android, enable <strong className="text-white">"Allow from this source"</strong> and tap <strong className="text-white">Install</strong>. Launch and enjoy!
              </p>
            </div>
          </div>

          <div className="text-center pt-2">
            <a
              href={downloadUrl}
              download="moviebuzz.apk"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-brand-400 hover:text-brand-300 hover:underline"
            >
              <span>Download MovieBuzz {version} Now</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Technical Specs Table */}
        <div className="max-w-3xl mx-auto bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-dark-border pb-3">
            <Cpu className="w-5 h-5 text-brand-400" />
            Package Specifications
          </h2>

          <div className="divide-y divide-dark-border/60 text-xs sm:text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-gray-400">Application Name</span>
              <span className="font-semibold text-white">MovieBuzz</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-gray-400">Current Version</span>
              <span className="font-semibold text-white">{version} (Build 22)</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-gray-400">Minimum Android OS</span>
              <span className="font-semibold text-white">Android 6.0 (API Level 23)</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-gray-400">Target Architecture</span>
              <span className="font-semibold text-white">arm64-v8a, armeabi-v7a, x86_64</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-gray-400">Package File Size</span>
              <span className="font-semibold text-white">{apkSize}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-gray-400">Security / Safety</span>
              <span className="font-semibold text-emerald-400">SHA-256 Verified Clean</span>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-white">Frequently Asked Questions</h2>
            <p className="text-xs text-gray-400">Everything you need to know about installing MovieBuzz.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isExpanded = expandedFaq === index;
              return (
                <div
                  key={index}
                  className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setExpandedFaq(isExpanded ? null : index)}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left text-xs sm:text-sm font-bold text-white hover:text-brand-400 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-5 sm:px-5 sm:pb-5 text-xs text-gray-300 leading-relaxed border-t border-dark-border/40 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA Card */}
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-brand-600 via-red-600 to-amber-600 rounded-3xl p-8 sm:p-12 text-center text-white shadow-2xl space-y-6">
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
            Ready to Experience MovieBuzz?
          </h2>
          <p className="text-xs sm:text-base text-white/90 max-w-xl mx-auto leading-relaxed">
            Download the official Android APK now and get instant access to unlimited movies and web series in stunning cinema quality.
          </p>
          <a
            href={downloadUrl}
            download="moviebuzz.apk"
            className="inline-flex items-center gap-2.5 px-8 py-4 bg-white text-gray-900 hover:bg-gray-100 font-black text-sm sm:text-base rounded-2xl shadow-xl transform hover:scale-105 active:scale-95 transition-all"
          >
            <Download className="w-5 h-5 text-brand-600 flex-shrink-0" />
            <span>Install MovieBuzz {version} Now</span>
          </a>
        </div>
      </div>
    </div>
  );
};
