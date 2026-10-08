import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Settings,
  Tv,
  Check,
  Sun,
  Loader2,
} from 'lucide-react';
import { Media } from '../types';
import { useAuth } from '../context/AuthContext';
import { saveLocalPlaybackPosition } from '../utils/localStorage';
import { saveWatchProgress } from '../services/api';

interface VideoPlayerProps {
  mediaList: Media[];
  contentId: string;
  episodeId?: string;
  contentTitle: string;
  posterUrl: string;
  contentSlug: string;
  contentType: 'movie' | 'series';
  initialPosition?: number;
  onEnded?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  mediaList,
  contentId,
  episodeId,
  contentTitle,
  posterUrl,
  contentSlug,
  contentType,
  initialPosition = 0,
  onEnded,
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const resolveStreamUrl = (rawUrl?: string) => {
    if (!rawUrl) return '';
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const backendOrigin = apiBase.replace(/\/api\/?$/, '');

    if (rawUrl.startsWith('http://localhost:5000')) {
      return rawUrl.replace('http://localhost:5000', backendOrigin);
    }
    if (rawUrl.startsWith('/api/')) {
      return `${backendOrigin}${rawUrl}`;
    }
    return rawUrl;
  };

  const [selectedQuality, setSelectedQuality] = useState<string>(
    mediaList && mediaList.length > 0 ? mediaList[0].quality : '1080p'
  );
  const [streamUrl, setStreamUrl] = useState<string>(
    resolveStreamUrl(mediaList && mediaList.length > 0 ? mediaList[0].streamUrl : undefined)
  );

  useEffect(() => {
    if (mediaList && mediaList.length > 0) {
      const found = mediaList.find((m) => m.quality === selectedQuality) || mediaList[0];
      const resolved = resolveStreamUrl(found.streamUrl);
      setStreamUrl(resolved);
    }
  }, [mediaList, selectedQuality]);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(initialPosition);
  const [duration, setDuration] = useState<number>(0);

  // Audio Volume & Mute States
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Brightness Control (0.2 to 1.2)
  const [brightness, setBrightness] = useState<number>(1);

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Double click skip feedback indicator
  const [skipFeedback, setSkipFeedback] = useState<{ side: 'left' | 'right'; text: string; id: number } | null>(null);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const lastClickRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync quality change
  const handleQualityChange = (quality: string) => {
    const found = mediaList.find((m) => m.quality === quality);
    if (found) {
      setSelectedQuality(quality);
      const currentPos = videoRef.current?.currentTime || 0;
      setStreamUrl(resolveStreamUrl(found.streamUrl));
      setShowSettings(false);
      setIsBuffering(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = currentPos;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    }
  };

  // Throttled position saver
  const saveProgressThrottled = useCallback(
    (pos: number, dur: number) => {
      if (Math.abs(pos - lastSavedTimeRef.current) < 5) return;
      lastSavedTimeRef.current = pos;

      if (user) {
        saveWatchProgress({
          contentId,
          episodeId,
          progress: Math.floor(pos),
          duration: Math.floor(dur),
          completed: dur > 0 && pos / dur > 0.9,
        }).catch(() => {});
      } else {
        saveLocalPlaybackPosition({
          contentId,
          episodeId,
          contentSlug,
          contentType,
          title: contentTitle,
          posterUrl,
          position: Math.floor(pos),
          duration: Math.floor(dur),
        });
      }
    },
    [user, contentId, episodeId, contentSlug, contentType, contentTitle, posterUrl]
  );

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration || duration;
      setCurrentTime(cur);
      if (dur > 0) setDuration(dur);
      saveProgressThrottled(cur, dur);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if (initialPosition > 0) {
        videoRef.current.currentTime = initialPosition;
      }
    }
    setIsBuffering(false);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume || 1;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    setIsBuffering(true);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSettings(false);
  };

  // Fullscreen + Auto-Landscape Mobile Orientation
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
        setIsFullscreen(true);
        if (window.screen && window.screen.orientation && (window.screen.orientation as any).lock) {
          await (window.screen.orientation as any).lock('landscape').catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {});
        }
        if (window.screen && window.screen.orientation && (window.screen.orientation as any).unlock) {
          try {
            (window.screen.orientation as any).unlock();
          } catch {}
        }
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen(!isFullscreen);
    }
  };

  // Listen to fullscreen changes to reset orientation
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isFs);
      if (!isFs && window.screen && window.screen.orientation && (window.screen.orientation as any).unlock) {
        try {
          (window.screen.orientation as any).unlock();
        } catch {}
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const togglePictureInPicture = async () => {
    if (videoRef.current) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(() => {});
      } else {
        await videoRef.current.requestPictureInPicture().catch(() => {});
      }
    }
  };

  // Container click handler with Double-Tap Skip (-10s / +10s)
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, .no-player-click')) return;

    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    const clickX = e.clientX - (rect?.left || 0);
    const width = rect?.width || 1;

    if (now - lastClickRef.current.time < 300) {
      // Double Tap Detected
      if (singleClickTimerRef.current) clearTimeout(singleClickTimerRef.current);

      if (clickX < width / 2) {
        // Rewind -10s
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
        }
        setSkipFeedback({ side: 'left', text: '-10s', id: Date.now() });
      } else {
        // Fast-Forward +10s
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
        }
        setSkipFeedback({ side: 'right', text: '+10s', id: Date.now() });
      }

      setTimeout(() => setSkipFeedback(null), 800);
      lastClickRef.current = { time: 0, x: 0 };
    } else {
      lastClickRef.current = { time: now, x: clickX };
      singleClickTimerRef.current = setTimeout(() => {
        togglePlay();
      }, 300);
    }
  };

  // Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleStall = useCallback(() => {
    setIsBuffering(true);
    if (videoRef.current && isPlaying) {
      const curPos = videoRef.current.currentTime;
      setTimeout(() => {
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.currentTime = curPos;
          videoRef.current.play().catch(() => {});
        }
      }, 1500);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      setIsBuffering(true);
    }
  }, [streamUrl]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={handleContainerClick}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group shadow-2xl select-none"
    >
      <video
        ref={videoRef}
        src={streamUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadStart={() => setIsBuffering(true)}
        onWaiting={handleStall}
        onStalled={handleStall}
        onSeeking={() => setIsBuffering(true)}
        onSeeked={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onPlay={() => {
          setIsPlaying(true);
          setIsBuffering(false);
          if (videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
          }
        }}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setIsBuffering(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        style={{ filter: `brightness(${brightness})` }}
        className="w-full h-full object-contain cursor-pointer transition-[filter] duration-150"
        playsInline
      />

      {/* Buffering Stream Spinner Overlay - Pure Animated Multi-Ring (No Text) */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm z-20 pointer-events-none animate-fade-in">
          <div className="relative flex items-center justify-center w-20 h-20">
            {/* Outer glowing spinning ring */}
            <div className="absolute inset-0 rounded-full border-4 border-t-brand-500 border-r-purple-500 border-b-cyan-400 border-l-transparent animate-spin drop-shadow-[0_0_15px_rgba(236,72,153,0.6)]" />
            {/* Inner reverse rotating ring */}
            <div className="absolute inset-2 rounded-full border-4 border-t-amber-400 border-r-pink-500 border-b-indigo-500 border-l-transparent animate-spin [animation-direction:reverse] [animation-duration:1.2s]" />
            {/* Pulsing center core */}
            <div className="w-5 h-5 bg-gradient-to-tr from-brand-500 to-cyan-400 rounded-full animate-pulse shadow-[0_0_20px_rgba(236,72,153,0.9)]" />
          </div>
        </div>
      )}

      {/* Double Tap Skip Feedback Indicators */}
      {skipFeedback?.side === 'left' && (
        <div className="absolute left-8 sm:left-16 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-20 h-20 bg-black/80 backdrop-blur-md rounded-full border border-white/20 text-white z-30 pointer-events-none shadow-2xl animate-bounce">
          <RotateCcw className="w-7 h-7 text-brand-500" />
          <span className="text-xs font-black font-mono mt-0.5">{skipFeedback.text}</span>
        </div>
      )}
      {skipFeedback?.side === 'right' && (
        <div className="absolute right-8 sm:right-16 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-20 h-20 bg-black/80 backdrop-blur-md rounded-full border border-white/20 text-white z-30 pointer-events-none shadow-2xl animate-bounce">
          <RotateCw className="w-7 h-7 text-brand-500" />
          <span className="text-xs font-black font-mono mt-0.5">{skipFeedback.text}</span>
        </div>
      )}

      {/* MOBILE ONLY: Parallel Side Vertical Sliders (Left: Brightness, Right: Volume) */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 left-3 right-3 flex justify-between items-center pointer-events-none transition-opacity duration-300 z-30 sm:hidden ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Left Side: Mobile Brightness Slider */}
        <div className="pointer-events-auto no-player-click flex flex-col items-center bg-black/75 backdrop-blur-md p-2 rounded-2xl border border-white/10 space-y-2 shadow-2xl">
          <Sun className="w-4 h-4 text-amber-400" />
          <input
            type="range"
            min={0.2}
            max={1.2}
            step={0.05}
            value={brightness}
            onChange={(e) => setBrightness(parseFloat(e.target.value))}
            className="w-1.5 h-24 accent-amber-400 bg-gray-700/80 rounded-lg appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
            title={`Brightness: ${Math.round(brightness * 100)}%`}
          />
          <span className="text-[9px] font-mono font-bold text-amber-400">{Math.round(brightness * 100)}%</span>
        </div>

        {/* Right Side: Mobile Volume Slider */}
        <div className="pointer-events-auto no-player-click flex flex-col items-center bg-black/75 backdrop-blur-md p-2 rounded-2xl border border-white/10 space-y-2 shadow-2xl">
          <button onClick={toggleMute} className="hover:text-brand-500 transition-colors">
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-brand-500" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-1.5 h-24 accent-brand-500 bg-gray-700/80 rounded-lg appearance-none cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />
          <span className="text-[9px] font-mono font-bold text-brand-500">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
        </div>
      </div>

      {/* Overlay Title when paused or hovering */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-300 pointer-events-none flex items-center justify-between z-20 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div>
          <h3 className="text-white font-bold text-sm sm:text-xl drop-shadow truncate max-w-xs sm:max-w-md">{contentTitle}</h3>
          <p className="text-[11px] text-brand-500 font-semibold uppercase tracking-wider">{selectedQuality} Streaming</p>
        </div>
      </div>

      {/* Center Big Play Button when paused */}
      {!isPlaying && !isBuffering && (
        <button
          onClick={togglePlay}
          className="no-player-click absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 bg-brand-500/90 hover:bg-brand-500 rounded-full flex items-center justify-center text-white shadow-2xl transition-transform hover:scale-110 z-20"
        >
          <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1" />
        </button>
      )}

      {/* Player Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 sm:p-5 bg-gradient-to-t from-black/95 via-black/80 to-transparent transition-opacity duration-300 space-y-2.5 z-30 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Scrub Bar */}
        <div className="relative flex items-center no-player-click">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-gray-700/80 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:h-2.5 transition-all"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between text-white no-player-click">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button onClick={togglePlay} className="hover:text-brand-500 transition-colors">
              {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                setSkipFeedback({ side: 'left', text: '-10s', id: Date.now() });
                setTimeout(() => setSkipFeedback(null), 800);
              }}
              className="hover:text-gray-300 transition-colors"
              title="Seek back 10s"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Timestamp */}
            <div className="text-[11px] sm:text-xs font-mono text-gray-300">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-gray-500">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Tools & DESKTOP Sliders */}
          <div className="flex items-center space-x-2.5 sm:space-x-4 relative">
            {/* DESKTOP ONLY: Brightness Control */}
            <div className="hidden sm:flex items-center space-x-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10" title="Adjust Brightness">
              <Sun className="w-4 h-4 text-amber-400 flex-none" />
              <input
                type="range"
                min={0.2}
                max={1.2}
                step={0.05}
                value={brightness}
                onChange={(e) => setBrightness(parseFloat(e.target.value))}
                className="w-16 lg:w-24 h-1.5 accent-amber-400 bg-gray-700/80 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] font-mono text-amber-400 w-7 text-right">{Math.round(brightness * 100)}%</span>
            </div>

            {/* DESKTOP ONLY: Volume Control */}
            <div className="hidden sm:flex items-center space-x-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10" title="Adjust Volume">
              <button onClick={toggleMute} className="hover:text-brand-500 transition-colors flex-none">
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-brand-500" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 lg:w-24 h-1.5 accent-brand-500 bg-gray-700/80 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] font-mono text-brand-500 w-7 text-right">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
            </div>

            {/* Speed & Quality Settings Popup */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="hover:text-brand-500 transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            {showSettings && (
              <div className="absolute right-12 bottom-10 w-56 bg-dark-card border border-dark-border rounded-xl shadow-2xl p-3 z-50 text-xs space-y-3">
                <div>
                  <h4 className="font-bold text-gray-400 uppercase tracking-wider mb-1.5">Quality</h4>
                  <div className="space-y-1">
                    {mediaList && mediaList.length > 0 ? (
                      mediaList.map((m) => (
                        <button
                          key={m._id}
                          onClick={() => handleQualityChange(m.quality)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                            selectedQuality === m.quality ? 'bg-brand-500 text-white' : 'hover:bg-dark-hover text-gray-300'
                          }`}
                        >
                          <span>{m.quality} ({m.resolution})</span>
                          {selectedQuality === m.quality && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))
                    ) : (
                      <span className="text-gray-400">1080p Standard</span>
                    )}
                  </div>
                </div>

                <div className="border-t border-dark-border pt-2">
                  <h4 className="font-bold text-gray-400 uppercase tracking-wider mb-1.5">Speed</h4>
                  <div className="grid grid-cols-4 gap-1">
                    {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`py-1 rounded text-center font-medium ${
                          playbackSpeed === speed ? 'bg-brand-500 text-white' : 'bg-dark-surface text-gray-300 hover:bg-dark-hover'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PiP */}
            <button onClick={togglePictureInPicture} className="hover:text-gray-300 transition-colors hidden sm:block" title="Picture in Picture">
              <Tv className="w-5 h-5" />
            </button>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="hover:text-gray-300 transition-colors" title="Toggle Fullscreen">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
