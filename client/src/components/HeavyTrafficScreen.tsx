import React, { useState } from 'react';
import { useServerError } from '../context/ServerErrorContext';
import {
  ServerCrash,
  RefreshCw,
  Clock,
  Film,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const HeavyTrafficScreen: React.FC = () => {
  const { isServerDown, errorInfo, isChecking, countdown, retryConnection, clearServerError } =
    useServerError();
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [lastCheckFailed, setLastCheckFailed] = useState(false);

  if (!isServerDown) return null;

  const handleManualRetry = async () => {
    setLastCheckFailed(false);
    const success = await retryConnection();
    if (!success) {
      setLastCheckFailed(true);
    }
  };

  const handleHardReload = () => {
    window.location.reload();
  };

  return (
    <div
      id="heavy-traffic-screen"
      className="fixed inset-0 z-[9999] min-h-screen w-full bg-[#09090b] text-gray-100 flex flex-col justify-between overflow-y-auto selection:bg-brand-500 selection:text-white"
    >
      {/* Background Ambience & Lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/15 rounded-full blur-[140px] animate-pulse-slow" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[130px]" />
        {/* Subtle cinematic grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Top Header / Brand Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 sm:py-8 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-red-500 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-black tracking-wider text-lg">
            <Film className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center">
              MOVIE<span className="text-brand-500">BUZZ</span>
            </span>
            <span className="text-[10px] tracking-widest uppercase text-gray-400 font-semibold">
              Ultra HD Streaming
            </span>
          </div>
        </div>

        {/* Live Traffic Badge */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span className="font-semibold tracking-wide uppercase text-[11px]">Heavy Traffic Surge</span>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-xl mx-auto bg-dark-surface/90 border border-dark-border/80 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-6 sm:space-y-8 animate-fade-in relative overflow-hidden">
          {/* Subtle top edge glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-80" />

          {/* Traffic Indicator Graphic */}
          <div className="relative mx-auto w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
            {/* Pulsing rings */}
            <div className="absolute inset-0 rounded-full bg-brand-500/10 animate-ping opacity-60" />
            <div className="absolute -inset-2 rounded-full border border-brand-500/20 animate-pulse" />
            
            {/* Center icon container */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-b from-dark-card to-dark-surface border border-red-500/30 flex items-center justify-center shadow-xl shadow-brand-500/10">
              <ServerCrash className="w-10 h-10 sm:w-12 sm:h-12 text-brand-500 animate-pulse" />
            </div>

            {/* Warning tag badge */}
            <div className="absolute -bottom-2 px-2.5 py-0.5 rounded-full bg-red-950/90 border border-red-500/40 text-red-300 text-[10px] font-bold tracking-wider uppercase">
              Traffic Peak
            </div>
          </div>

          {/* Headings & Requested Message */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              We&apos;re Experiencing Heavy Traffic
            </h1>
            <p className="text-sm sm:text-base text-gray-300 font-normal leading-relaxed max-w-md mx-auto">
              Sorry, we are facing heavy traffic on our site right now. Thousands of users are streaming simultaneously, causing temporary delays on our servers.
            </p>
            <p className="text-xs sm:text-sm text-brand-400/90 font-medium">
              Please wait a moment and try again after some time.
            </p>
          </div>

          {/* Auto-Retry Progress / Countdown Bar */}
          <div className="bg-dark-card/60 border border-dark-border/60 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
              <div className="flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Auto-refreshing in:</span>
              </div>
              <span className="font-bold text-white text-sm tabular-nums">
                {countdown} <span className="text-gray-400 font-normal text-xs">sec</span>
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-dark-base rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-brand-500 h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${Math.max(5, (countdown / 15) * 100)}%` }}
              />
            </div>

            {lastCheckFailed && (
              <div className="flex items-center justify-center space-x-1.5 text-xs text-amber-400 animate-fade-in pt-1">
                <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Server is still busy. Retrying automatically...</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleManualRetry}
              disabled={isChecking}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Testing Connection...' : 'Try Again Now'}</span>
            </button>

            <button
              onClick={handleHardReload}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-300 hover:text-white font-medium text-sm transition-all cursor-pointer"
            >
              Refresh Page
            </button>
          </div>

          {/* Technical Diagnostics Accordion */}
          <div className="pt-2 border-t border-dark-border/40 text-left">
            <button
              onClick={() => setShowTechDetails(!showTechDetails)}
              className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-300 py-1 transition-colors"
            >
              <span className="flex items-center space-x-1.5">
                <Zap className="w-3 h-3 text-brand-500" />
                <span>Diagnostic Information</span>
              </span>
              {showTechDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showTechDetails && (
              <div className="mt-2.5 p-3 rounded-xl bg-dark-base/80 border border-dark-border text-[11px] text-gray-400 font-mono space-y-1 animate-fade-in">
                <div className="flex justify-between">
                  <span className="text-gray-400">Response Code:</span>
                  <span className="text-amber-400 font-bold">{errorInfo?.status || 503} Service Unavailable</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Reason:</span>
                  <span className="text-gray-300 truncate max-w-[260px]">{errorInfo?.message || 'High server latency / heavy load'}</span>
                </div>
                {errorInfo?.timestamp && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Triggered At:</span>
                    <span className="text-gray-300">{errorInfo.timestamp}</span>
                  </div>
                )}
                <div className="pt-2 text-[10px] text-gray-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Cloud auto-scaling instances are deploying to handle demand.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer reassurance */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-gray-400 border-t border-dark-border/30">
        <p>
          Your watchlist, favorites, and playback progress are safely stored locally on your device.
        </p>
      </footer>
    </div>
  );
};
export default HeavyTrafficScreen;
