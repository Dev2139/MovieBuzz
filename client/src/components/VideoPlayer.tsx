import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Settings,
  Tv,
  Check,
  RotateCw,
  X,
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
    if (!rawUrl) return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const apiBase = import.meta.env.VITE_API_URL || 'https://moviebuzz-99fb.onrender.com/api';
    const backendOrigin = apiBase.replace(/\/api\/?$/, '');

    if (rawUrl.startsWith('http://localhost:5000')) {
      return rawUrl.replace('http://localhost:5000', backendOrigin);
    }
    if (rawUrl.startsWith('https://movie-buzz-kappa.vercel.app')) {
      return rawUrl.replace('https://movie-buzz-kappa.vercel.app', backendOrigin);
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

  // Double-tap visual feedback states
  const [seekFeedback, setSeekFeedback] = useState<{ type: 'left' | 'right'; id: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number }>({ x: 0 });

  // Sync streamUrl state whenever mediaList prop finishes loading or changes
  useEffect(() => {
    if (mediaList && mediaList.length > 0) {
      const found = mediaList.find((m) => m.quality === selectedQuality) || mediaList[0];
      const resolved = resolveStreamUrl(found.streamUrl);
      setStreamUrl(resolved);
    }
  }, [mediaList, selectedQuality]);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(initialPosition);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTimeRef = useRef<number>(0);

  // Quality Switch
  const handleQualityChange = (quality: string) => {
    const found = mediaList.find((m) => m.quality === quality);
    if (found) {
      setSelectedQuality(quality);
      const currentPos = videoRef.current?.currentTime || 0;
      setStreamUrl(resolveStreamUrl(found.streamUrl));
      setShowSettings(false);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = currentPos;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    }
  };

  // Save Progress Throttled
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

  // Double-tap or touch click handler
  const handleTouchContainer = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    let clientX = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
    }

    if (rect) {
      const relativeX = clientX - rect.left;
      const width = rect.width;
      const isDoubleTap = now - lastTapTimeRef.current < 300 && Math.abs(relativeX - lastTapPosRef.current.x) < 80;

      if (isDoubleTap) {
        if (relativeX < width * 0.4) {
          // Double tap left -> Rewind 10s
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          }
          setSeekFeedback({ type: 'left', id: Date.now() });
        } else if (relativeX > width * 0.6) {
          // Double tap right -> Fast forward 10s
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
          }
          setSeekFeedback({ type: 'right', id: Date.now() });
        } else {
          togglePlay();
        }
        setTimeout(() => setSeekFeedback(null), 800);
      } else {
        // Single tap -> toggle controls
        setShowControls((prev) => !prev);
      }

      lastTapTimeRef.current = now;
      lastTapPosRef.current = { x: relativeX };
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

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePictureInPicture = async () => {
    if (videoRef.current) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(() => {});
      } else {
        await videoRef.current.requestPictureInPicture().catch(() => {});
      }
    }
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

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
    }
  }, [streamUrl]);

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
      onClick={handleTouchContainer}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group shadow-2xl select-none"
    >
      <video
        ref={videoRef}
        src={streamUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => {
          setIsPlaying(true);
          if (videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
          }
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={handleStall}
        onStalled={handleStall}
        onError={() => {
          if (videoRef.current && !streamUrl.includes('sample/TearsOfSteel.mp4')) {
            setStreamUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        className="w-full h-full object-contain cursor-pointer"
        poster={posterUrl}
        playsInline
      />

      {/* Double Tap Ripple Indicator Overlay */}
      {seekFeedback && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-30 transition-all ${
            seekFeedback.type === 'left' ? 'left-12' : 'right-12'
          }`}
        >
          <div className="w-20 h-20 bg-brand-500/80 backdrop-blur-md rounded-full flex flex-col items-center justify-center text-white shadow-2xl animate-ping">
            {seekFeedback.type === 'left' ? <RotateCcw className="w-8 h-8" /> : <RotateCw className="w-8 h-8" />}
            <span className="text-xs font-black mt-1">{seekFeedback.type === 'left' ? '-10s' : '+10s'}</span>
          </div>
        </div>
      )}

      {/* Overlay Title Header when paused or showing controls */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-b from-black/85 via-black/40 to-transparent transition-opacity duration-300 pointer-events-none flex items-center justify-between z-20 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div>
          <h3 className="text-white font-bold text-sm sm:text-lg drop-shadow line-clamp-1">{contentTitle}</h3>
          <p className="text-[10px] sm:text-xs text-brand-500 font-semibold uppercase tracking-wider">
            {selectedQuality} Streaming
          </p>
        </div>
      </div>

      {/* Center Big Play / Pause Button */}
      {(!isPlaying || showControls) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 m-auto w-16 h-16 sm:w-20 sm:h-20 bg-brand-500/90 hover:bg-brand-500 active:scale-95 rounded-full flex items-center justify-center text-white shadow-2xl transition-all z-20"
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-white" />
          ) : (
            <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1" />
          )}
        </button>
      )}

      {/* Player Controls Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 left-0 right-0 p-3 sm:p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 space-y-2 sm:space-y-3 z-20 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Seek Progress Bar */}
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 sm:h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:h-2.5 transition-all"
          />
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button
              onClick={togglePlay}
              className="p-1 hover:text-brand-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
              }}
              className="p-1 hover:text-gray-300 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="Seek back 10s"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Volume Control */}
            <div className="hidden sm:flex items-center space-x-2">
              <button onClick={toggleMute} className="hover:text-gray-300 transition-colors p-1">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Timestamp */}
            <div className="text-[11px] sm:text-xs font-mono text-gray-300">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-gray-500">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Tools (Settings, PiP, Fullscreen) */}
          <div className="flex items-center space-x-2 sm:space-x-4 relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 hover:text-brand-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Desktop Settings Popover */}
            {showSettings && (
              <div className="hidden sm:block absolute right-12 bottom-10 w-56 bg-dark-card border border-dark-border rounded-xl shadow-2xl p-3 z-50 text-xs space-y-3 animate-fade-in">
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
            <button
              onClick={togglePictureInPicture}
              className="hidden sm:flex p-1 hover:text-gray-300 transition-colors min-w-[36px] min-h-[36px] items-center justify-center"
              title="Picture in Picture"
            >
              <Tv className="w-5 h-5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1 hover:text-gray-300 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Settings Modal Sheet */}
      {showSettings && (
        <div className="sm:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end animate-fade-in">
          <div className="w-full bg-dark-card border-t border-dark-border rounded-t-2xl p-5 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <h3 className="font-bold text-base">Playback Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h4 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-2">Streaming Quality</h4>
              <div className="grid grid-cols-2 gap-2">
                {mediaList && mediaList.length > 0 ? (
                  mediaList.map((m) => (
                    <button
                      key={m._id}
                      onClick={() => handleQualityChange(m.quality)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                        selectedQuality === m.quality
                          ? 'bg-brand-500 border-brand-500 text-white'
                          : 'bg-dark-surface border-dark-border text-gray-300'
                      }`}
                    >
                      <span>{m.quality}</span>
                      {selectedQuality === m.quality && <Check className="w-4 h-4" />}
                    </button>
                  ))
                ) : (
                  <span className="text-gray-400 text-xs">1080p Standard</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-2">Playback Speed</h4>
              <div className="grid grid-cols-5 gap-2">
                {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`py-2 rounded-xl text-center text-xs font-medium border ${
                      playbackSpeed === speed
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'bg-dark-surface border-dark-border text-gray-300'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
