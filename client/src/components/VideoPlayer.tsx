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
  Film,
  Download,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { Media } from '../types';
import { useAuth } from '../context/AuthContext';
import { saveLocalPlaybackPosition } from '../utils/localStorage';
import { resolveMediaUrl } from '../utils/url';
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
  tmdbId?: number;
  imdbId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
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
  tmdbId,
  imdbId,
  seasonNumber = 1,
  episodeNumber = 1,
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasPartner = Boolean(tmdbId || imdbId);
  const [streamSource, setStreamSource] = useState<'partner' | 'telegram'>(() => {
    return hasPartner ? 'partner' : 'telegram';
  });

  useEffect(() => {
    if (!hasPartner && streamSource !== 'telegram') {
      setStreamSource('telegram');
    }
  }, [hasPartner, streamSource]);

  const getPartnerUrl = (): string | null => {
    if (!tmdbId && !imdbId) return null;
    const isMovie = contentType === 'movie';
    const s = seasonNumber || 1;
    const e = episodeNumber || 1;

    if (tmdbId) {
      return isMovie
        ? `https://player.autoembed.cc/embed/movie/${tmdbId}`
        : `https://player.autoembed.cc/embed/tv/${tmdbId}/${s}/${e}`;
    }
    return isMovie
      ? `https://player.autoembed.cc/embed/movie/${imdbId}`
      : `https://player.autoembed.cc/embed/tv/${imdbId}/${s}/${e}`;
  };

  const partnerStreamUrl = getPartnerUrl();

  const [selectedQuality, setSelectedQuality] = useState<string>(
    mediaList && mediaList.length > 0 ? mediaList[0].quality : '1080p'
  );
  const [streamUrl, setStreamUrl] = useState<string>(
    resolveMediaUrl(mediaList && mediaList.length > 0 ? mediaList[0].streamUrl : undefined)
  );

  const activeMedia = mediaList && mediaList.length > 0
    ? (mediaList.find((m) => m.quality === selectedQuality) || mediaList[0])
    : null;
  const currentDownloadUrl = resolveMediaUrl(activeMedia?.downloadUrl);

  useEffect(() => {
    if (mediaList && mediaList.length > 0) {
      const found = mediaList.find((m) => m.quality === selectedQuality) || mediaList[0];
      const resolved = resolveMediaUrl(found.streamUrl);
      setStreamUrl(resolved);
      setStreamError(null); // clear error on quality/source change
    }
  }, [mediaList, selectedQuality]);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(initialPosition);
  const [duration, setDuration] = useState<number>(0);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Audio Volume, Mute, Boost & Track States
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioBoost, setAudioBoost] = useState<number>(1); // 1 = 100%, 1.5 = 150%, 2 = 200%
  const [audioTracksList, setAudioTracksList] = useState<Array<{ index: number; label: string; language: string }>>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(0);
  const [showAudioHelp, setShowAudioHelp] = useState<boolean>(false);
  const [isTranscodeMode, setIsTranscodeMode] = useState<boolean>(false);

  const getEffectiveStreamUrl = (baseStreamUrl: string, transcode: boolean) => {
    if (!baseStreamUrl) return '';
    if (!transcode) return baseStreamUrl;
    if (baseStreamUrl.includes('/proxy-file/')) {
      return baseStreamUrl.replace('/proxy-file/', '/transcode-stream/');
    }
    const separator = baseStreamUrl.includes('?') ? '&' : '?';
    return `${baseStreamUrl}${separator}transcode=true`;
  };

  const handleToggleTranscodeMode = () => {
    const next = !isTranscodeMode;
    setIsTranscodeMode(next);
    const currentPos = videoRef.current?.currentTime || 0;
    setIsBuffering(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.currentTime = currentPos;
        videoRef.current.play().catch(() => {});
      }
    }, 150);
  };

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Initialize or resume Web Audio API graph to control device audio output directly (bypassing mobile volume locks)
  const ensureAudioContext = useCallback(() => {
    try {
      if (!audioContextRef.current && videoRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (!mediaSourceRef.current) {
            const source = ctx.createMediaElementSource(videoRef.current);
            const compressor = ctx.createDynamicsCompressor();
            const gain = ctx.createGain();
            gain.gain.value = isMuted ? 0 : volume * audioBoost;

            source.connect(compressor);
            compressor.connect(gain);
            gain.connect(ctx.destination);

            mediaSourceRef.current = source;
            gainNodeRef.current = gain;
          }
          audioContextRef.current = ctx;
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    } catch (err) {
      console.warn('AudioContext setup:', err);
    }
  }, [isMuted, volume, audioBoost]);

  // Master volume controller: controls both HTMLMediaElement and Web Audio API gain for real physical device volume output
  const updateVolume = useCallback(
    (newVol: number, explicitMute?: boolean) => {
      ensureAudioContext();
      const clampedVol = Math.max(0, Math.min(1, newVol));
      const nextMuted = explicitMute !== undefined ? explicitMute : clampedVol === 0;

      setVolume(clampedVol);
      setIsMuted(nextMuted);

      if (videoRef.current) {
        try {
          videoRef.current.volume = nextMuted ? 0 : clampedVol;
          videoRef.current.muted = nextMuted;
        } catch {}
      }

      if (gainNodeRef.current) {
        try {
          gainNodeRef.current.gain.value = nextMuted ? 0 : clampedVol * audioBoost;
        } catch {}
      }

      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    },
    [audioBoost, ensureAudioContext]
  );

  const handleAudioBoostChange = (boostMultiplier: number) => {
    try {
      ensureAudioContext();
      setAudioBoost(boostMultiplier);
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = isMuted ? 0 : volume * boostMultiplier;
      }
    } catch (err) {
      console.warn('Audio boost setup notice:', err);
    }
  };

  const checkAudioTracks = () => {
    const vid = videoRef.current as any;
    if (vid && vid.audioTracks && vid.audioTracks.length > 1) {
      const tracks = [];
      for (let i = 0; i < vid.audioTracks.length; i++) {
        const t = vid.audioTracks[i];
        tracks.push({
          index: i,
          label: t.label || `Audio Track ${i + 1}${t.language ? ` (${t.language})` : ''}`,
          language: t.language || '',
        });
      }
      setAudioTracksList(tracks);
    }
  };

  const handleSelectAudioTrack = (trackIndex: number) => {
    const vid = videoRef.current as any;
    if (vid && vid.audioTracks) {
      for (let i = 0; i < vid.audioTracks.length; i++) {
        vid.audioTracks[i].enabled = i === trackIndex;
      }
      setSelectedAudioTrack(trackIndex);
    }
  };

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
      setStreamUrl(resolveMediaUrl(found.streamUrl));
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

  const hasAppliedInitialPosRef = useRef<boolean>(false);

  // Reset initial position applied flag if stream or content changes
  useEffect(() => {
    hasAppliedInitialPosRef.current = false;
  }, [streamUrl, contentId, episodeId]);

  // Immediately save position without throttle (for unmount, page hide, reload, pause)
  const saveCurrentPositionImmediately = useCallback(() => {
    if (videoRef.current && videoRef.current.currentTime > 0) {
      const pos = videoRef.current.currentTime;
      const dur = videoRef.current.duration || duration;

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
    }
  }, [user, contentId, episodeId, contentSlug, contentType, contentTitle, posterUrl, duration]);

  // Throttled position saver
  const saveProgressThrottled = useCallback(
    (pos: number, dur: number) => {
      if (Math.abs(pos - lastSavedTimeRef.current) < 5) return;
      lastSavedTimeRef.current = pos;
      saveCurrentPositionImmediately();
    },
    [saveCurrentPositionImmediately]
  );

  // Save on page reload, tab switch, unmount
  useEffect(() => {
    const handleUnload = () => {
      saveCurrentPositionImmediately();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPositionImmediately();
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      saveCurrentPositionImmediately();
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [saveCurrentPositionImmediately]);

  // Apply initial position whenever video is ready or initialPosition prop updates
  useEffect(() => {
    if (
      !hasAppliedInitialPosRef.current &&
      initialPosition > 0 &&
      videoRef.current &&
      videoRef.current.readyState >= 1
    ) {
      videoRef.current.currentTime = initialPosition;
      setCurrentTime(initialPosition);
      hasAppliedInitialPosRef.current = true;
    }
  }, [initialPosition, streamUrl]);

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
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (!hasAppliedInitialPosRef.current && initialPosition > 0) {
        videoRef.current.currentTime = initialPosition;
        setCurrentTime(initialPosition);
        hasAppliedInitialPosRef.current = true;
      }
      checkAudioTracks();
    }
    setIsBuffering(false);
  };

  const togglePlay = () => {
    ensureAudioContext();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
        videoRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    updateVolume(val, val === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      const restored = volume > 0 ? volume : 1;
      updateVolume(restored, false);
    } else {
      updateVolume(volume, true);
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

  const touchStartRef = useRef<{
    x: number;
    y: number;
    brightness: number;
    volume: number;
    isGesture: boolean;
  } | null>(null);

  const gestureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [gestureHUD, setGestureHUD] = useState<{
    type: 'brightness' | 'volume';
    value: number;
  } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    ensureAudioContext();
    if ((e.target as HTMLElement).closest('button, input, .no-player-click')) return;

    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    touchStartRef.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      brightness,
      volume: isMuted ? 0 : volume,
      isGesture: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || !containerRef.current) return;
    if ((e.target as HTMLElement).closest('button, input, .no-player-click')) return;

    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;

    const deltaY = touchStartRef.current.y - currentY; // positive when swiping up
    const deltaX = Math.abs(currentX - touchStartRef.current.x);

    if (Math.abs(deltaY) > 8 && Math.abs(deltaY) > deltaX) {
      touchStartRef.current.isGesture = true;
      const height = rect.height || 300;
      const ratio = (deltaY / height) * 1.3;

      if (touchStartRef.current.x < rect.width / 2) {
        // Left side swipe: Brightness
        const newB = Math.max(0.2, Math.min(1.2, touchStartRef.current.brightness + ratio));
        setBrightness(newB);
        setGestureHUD({ type: 'brightness', value: Math.round(newB * 100) });
      } else {
        // Right side swipe: Controls device volume output directly via Web Audio gain + media volume
        const newV = Math.max(0, Math.min(1, touchStartRef.current.volume + ratio));
        updateVolume(newV, newV === 0);
        setGestureHUD({ type: 'volume', value: Math.round(newV * 100) });
      }

      if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
      gestureTimeoutRef.current = setTimeout(() => {
        setGestureHUD(null);
      }, 800);
    }
  };

  const handleTouchEnd = () => {
    if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
    gestureTimeoutRef.current = setTimeout(() => {
      setGestureHUD(null);
    }, 700);
  };

  // Container click handler with Double-Tap Skip (-10s / +10s) and Single-Tap Toggle Controls
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, .no-player-click')) return;

    // Skip click action if touch gesture swipe occurred
    if (touchStartRef.current?.isGesture) {
      touchStartRef.current = null;
      return;
    }

    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    const clickX = e.clientX - (rect?.left || 0);
    const width = rect?.width || 1;

    if (now - lastClickRef.current.time < 300) {
      // Double Tap Detected (-10s / +10s)
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
      // Single Tap: Toggle Controls overlay without pausing movie
      lastClickRef.current = { time: now, x: clickX };
      singleClickTimerRef.current = setTimeout(() => {
        setShowControls((prev) => !prev);
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
  }, [streamUrl, isTranscodeMode]);

  return (
    <div className="space-y-3">
      {/* Player Container */}
      <div
        ref={containerRef}
        onMouseMove={streamSource === 'telegram' ? handleMouseMove : undefined}
        onClick={streamSource === 'telegram' ? handleContainerClick : undefined}
        onTouchStart={streamSource === 'telegram' ? handleTouchStart : undefined}
        onTouchMove={streamSource === 'telegram' ? handleTouchMove : undefined}
        onTouchEnd={streamSource === 'telegram' ? handleTouchEnd : undefined}
        className="relative w-full aspect-video bg-black rounded-xl sm:rounded-2xl overflow-hidden group shadow-2xl select-none touch-none"
      >
        {streamSource === 'partner' ? (
          <div className="relative w-full h-full bg-black">
            {partnerStreamUrl ? (
              <iframe
                key={`partner-${tmdbId || imdbId}-${seasonNumber}-${episodeNumber}`}
                src={partnerStreamUrl}
                title={contentTitle}
                className="w-full h-full border-0 rounded-xl sm:rounded-2xl"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black/95 text-center px-6">
                <p className="text-white font-medium text-sm">Streaming partner unavailable for this title</p>
                <p className="text-gray-400 text-xs mt-1">Playing from your Telegram server instead.</p>
                <button
                  onClick={() => setStreamSource('telegram')}
                  className="mt-3 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold"
                >
                  Play with Telegram
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={getEffectiveStreamUrl(streamUrl, isTranscodeMode)}
              preload="auto"
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
          ensureAudioContext();
          if (videoRef.current) {
            videoRef.current.volume = isMuted ? 0 : volume;
            videoRef.current.muted = isMuted;
          }
          if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = isMuted ? 0 : volume * audioBoost;
          }
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
          }
        }}
        onPause={() => setIsPlaying(false)}
        crossOrigin="anonymous"
        onError={(e) => {
          const vid = e.currentTarget;
          const errCode = vid.error?.code;
          const errMsg = vid.error?.message || '';
          let userMsg = 'Video failed to load.';
          if (errCode === 2) userMsg = 'Network error — stream could not be fetched.';
          else if (errCode === 3) userMsg = 'Decoding error — unsupported video format.';
          else if (errCode === 4) userMsg = 'Source not supported — the stream format or codec is not supported by your browser.';
          else if (errMsg) userMsg = errMsg;
          setStreamError(userMsg);
          setIsBuffering(false);
          setIsPlaying(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        style={{ filter: `brightness(${brightness})` }}
        className="w-full h-full object-contain cursor-pointer transition-[filter] duration-150"
        playsInline
      />

      {/* Stream Error Overlay */}
      {streamError && !isBuffering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md z-20 pointer-events-auto animate-fade-in px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.293 4.293a1 1 0 011.414 0L21 13.586V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-5.414L10.293 4.293z" />
            </svg>
          </div>
          <h3 className="text-white font-bold text-lg mb-1">Stream Unavailable</h3>
          <p className="text-gray-400 text-xs max-w-md mb-5 leading-relaxed">{streamError}</p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-md">
            {hasPartner && (
              <button
                onClick={() => {
                  setStreamError(null);
                  setStreamSource('partner');
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-600 hover:to-brand-600 text-white rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-brand-500/25 flex items-center gap-1.5"
              >
                <Zap className="w-4 h-4 fill-current" />
                Switch to Cloud Streaming Partner
              </button>
            )}

            <button
              onClick={() => {
                setStreamError(null);
                setIsBuffering(true);
                if (videoRef.current) {
                  videoRef.current.load();
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-brand-500/25 flex items-center gap-1.5"
            >
              <RotateCw className="w-4 h-4" />
              Retry
            </button>

            {/* Quality Fallback Buttons */}
            {mediaList && mediaList.length > 1 && (
              mediaList
                .filter((m) => m.quality !== selectedQuality)
                .map((m) => (
                  <button
                    key={m._id}
                    onClick={() => handleQualityChange(m.quality)}
                    className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-gray-200 rounded-xl text-xs font-medium transition-all active:scale-95 border border-white/10"
                  >
                    Try {m.quality} ({m.resolution})
                  </button>
                ))
            )}

            {currentDownloadUrl && (
              <a
                href={currentDownloadUrl}
                download
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
              >
                <Download className="w-4 h-4" />
                Download to Play in VLC
              </a>
            )}
          </div>

          <p className="text-gray-500 text-[11px] mt-4 max-w-sm">
            💡 Tip: If this video format (e.g. MKV/HEVC/AC3) is unsupported by your browser, download it to watch with full audio on VLC or Windows Media Player.
          </p>
        </div>
      )}

      {/* Cinema 35mm Film Reel & Projector Stream Loader Overlay */}
      {isBuffering && (

        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20 pointer-events-none animate-fade-in">
          <div className="relative flex items-center justify-center w-24 h-24">
            {/* Projector Light Glow Halo */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-brand-500/30 via-purple-500/20 to-cyan-400/30 animate-pulse blur-xl" />

            {/* Main Spinning Cinema 35mm Film Reel */}
            <div className="relative w-20 h-20 animate-spin [animation-duration:3s]">
              <svg viewBox="0 0 100 100" className="w-full h-full text-brand-500 drop-shadow-[0_0_12px_rgba(236,72,153,0.9)]">
                {/* Outer Film Reel Rim */}
                <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="5" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                {/* Center Hub */}
                <circle cx="50" cy="50" r="14" fill="currentColor" />
                {/* 5 Film Reel Spoke Holes */}
                <circle cx="50" cy="24" r="9" fill="#000000" />
                <circle cx="75" cy="42" r="9" fill="#000000" />
                <circle cx="65" cy="71" r="9" fill="#000000" />
                <circle cx="35" cy="71" r="9" fill="#000000" />
                <circle cx="25" cy="42" r="9" fill="#000000" />
                {/* 12 Outer Film Sprocket Perforations */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                  <rect
                    key={deg}
                    x="48.5"
                    y="5"
                    width="3"
                    height="4"
                    rx="1"
                    fill="rgba(255,255,255,0.9)"
                    transform={`rotate(${deg} 50 50)`}
                  />
                ))}
              </svg>
            </div>

            {/* Inner Reverse-Spinning Film Core Icon */}
            <div className="absolute w-9 h-9 animate-spin [animation-direction:reverse] [animation-duration:1.5s]">
              <Film className="w-full h-full text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
            </div>

            {/* Center Projector Lens Ping Flare */}
            <div className="absolute w-3 h-3 bg-white rounded-full animate-ping shadow-[0_0_15px_#ffffff]" />
          </div>
        </div>
      )}

      {/* Floating Touch Swipe Gesture HUD Badge (Active while sliding) */}
      {gestureHUD && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-md border border-white/20 px-5 py-3 rounded-2xl flex items-center space-x-3 text-white z-40 pointer-events-none shadow-2xl animate-fade-in">
          {gestureHUD.type === 'brightness' ? (
            <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 flex-none animate-pulse" />
          ) : gestureHUD.value === 0 ? (
            <VolumeX className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 flex-none" />
          ) : (
            <Volume2 className="w-5 h-5 sm:w-6 sm:h-6 text-brand-500 flex-none animate-pulse" />
          )}
          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-gray-300">
              {gestureHUD.type === 'volume' ? 'Device Volume' : 'Brightness'}
            </span>
            <div className="w-24 sm:w-28 h-2 bg-gray-700/80 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  gestureHUD.type === 'brightness' ? 'bg-amber-400' : 'bg-brand-500'
                }`}
                style={{ width: `${Math.min(100, gestureHUD.value)}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-white w-8 text-right">{gestureHUD.value}%</span>
        </div>
      )}

      {/* Double Tap Skip Feedback Indicators */}
      {skipFeedback?.side === 'left' && (
        <div className="absolute left-6 sm:left-16 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-black/80 backdrop-blur-md rounded-full border border-white/20 text-white z-30 pointer-events-none shadow-2xl animate-bounce">
          <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500" />
          <span className="text-[11px] sm:text-xs font-black font-mono mt-0.5">{skipFeedback.text}</span>
        </div>
      )}
      {skipFeedback?.side === 'right' && (
        <div className="absolute right-6 sm:right-16 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-black/80 backdrop-blur-md rounded-full border border-white/20 text-white z-30 pointer-events-none shadow-2xl animate-bounce">
          <RotateCw className="w-6 h-6 sm:w-7 sm:h-7 text-brand-500" />
          <span className="text-[11px] sm:text-xs font-black font-mono mt-0.5">{skipFeedback.text}</span>
        </div>
      )}

      {/* Overlay Title when paused or hovering */}
      <div
        className={`absolute top-0 left-0 right-0 p-3 sm:p-5 bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-300 pointer-events-none flex items-center justify-between z-20 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="pr-4 min-w-0">
          <h3 className="text-white font-bold text-xs sm:text-lg drop-shadow truncate max-w-[200px] sm:max-w-md">{contentTitle}</h3>
          <p className="text-[10px] sm:text-[11px] text-brand-500 font-semibold uppercase tracking-wider">{selectedQuality} Streaming</p>
        </div>
      </div>

      {/* Center Big Play Button when paused */}
      {!isPlaying && !isBuffering && (
        <button
          onClick={togglePlay}
          className="no-player-click absolute inset-0 m-auto w-14 h-14 sm:w-20 sm:h-20 bg-brand-500/90 hover:bg-brand-500 rounded-full flex items-center justify-center text-white shadow-2xl transition-transform hover:scale-110 z-20"
          aria-label="Play video"
        >
          <Play className="w-7 h-7 sm:w-10 sm:h-10 fill-white ml-0.5" />
        </button>
      )}

      {/* Mobile-First Player Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-2 sm:p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent transition-opacity duration-300 space-y-1.5 sm:space-y-2.5 z-30 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrub Bar */}
        <div className="relative flex items-center no-player-click py-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 sm:h-1.5 bg-gray-700/80 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:h-2 transition-all touch-none"
            aria-label="Video seek scrubber"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between text-white no-player-click gap-2">
          {/* Left Controls: Play, Rewind 10s, Forward 10s, Timestamp */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0">
            <button
              onClick={togglePlay}
              className="p-1 sm:p-1.5 hover:text-brand-500 transition-colors flex-none"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                setSkipFeedback({ side: 'left', text: '-10s', id: Date.now() });
                setTimeout(() => setSkipFeedback(null), 800);
              }}
              className="p-1 sm:p-1.5 hover:text-gray-300 transition-colors flex-none"
              title="Seek back 10s"
              aria-label="Seek back 10s"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
                setSkipFeedback({ side: 'right', text: '+10s', id: Date.now() });
                setTimeout(() => setSkipFeedback(null), 800);
              }}
              className="p-1 sm:p-1.5 hover:text-gray-300 transition-colors flex-none"
              title="Seek forward 10s"
              aria-label="Seek forward 10s"
            >
              <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Timestamp */}
            <div className="text-[10px] sm:text-xs font-mono text-gray-300 truncate select-none whitespace-nowrap">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-0.5 sm:mx-1 text-gray-500">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls: Desktop Sliders (Hidden on mobile), Settings, PiP, Fullscreen */}
          <div className="flex items-center space-x-1 sm:space-x-3 relative flex-none">
            {/* DESKTOP ONLY: Brightness Control (Hidden on Mobile) */}
            <div className="hidden sm:flex items-center space-x-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10" title="Adjust Brightness">
              <Sun className="w-3.5 h-3.5 text-amber-400 flex-none" />
              <input
                type="range"
                min={0.2}
                max={1.2}
                step={0.05}
                value={brightness}
                onChange={(e) => setBrightness(parseFloat(e.target.value))}
                className="w-16 lg:w-20 h-1.5 accent-amber-400 bg-gray-700/80 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] font-mono text-amber-400 w-7 text-right">{Math.round(brightness * 100)}%</span>
            </div>

            {/* DESKTOP ONLY: Volume Control (Hidden on Mobile) */}
            <div className="hidden sm:flex items-center space-x-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10" title="Adjust Volume">
              <button onClick={toggleMute} className="hover:text-brand-500 transition-colors flex-none">
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-brand-500" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 lg:w-20 h-1.5 accent-brand-500 bg-gray-700/80 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] font-mono text-brand-500 w-7 text-right">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 sm:p-1.5 hover:text-brand-500 transition-colors flex-none"
              title="Settings"
              aria-label="Playback Settings"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Picture in Picture (Desktop only) */}
            <button onClick={togglePictureInPicture} className="p-1 sm:p-1.5 hover:text-gray-300 transition-colors hidden sm:block flex-none" title="Picture in Picture">
              <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="p-1 sm:p-1.5 hover:text-gray-300 transition-colors flex-none" title="Toggle Fullscreen" aria-label="Toggle Fullscreen">
              {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal: Mobile Bottom Sheet + Desktop Popover */}
      {showSettings && (
        <>
          {/* Mobile Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 sm:hidden"
            onClick={() => setShowSettings(false)}
          />

          <div className="fixed inset-x-0 bottom-0 sm:inset-auto sm:right-4 sm:bottom-14 w-full sm:w-72 bg-dark-card border-t sm:border border-dark-border rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 sm:p-3.5 z-50 text-xs space-y-3.5 max-h-[75vh] sm:max-h-96 overflow-y-auto animate-slide-up sm:animate-fade-in no-player-click">
            {/* Mobile Sheet Header */}
            <div className="flex items-center justify-between border-b border-dark-border pb-2.5 sm:hidden">
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4 text-brand-500" />
                <span className="font-bold text-white text-sm">Playback Settings</span>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>

            {/* Quality Selector */}
            <div>
              <h4 className="font-bold text-gray-400 uppercase tracking-wider mb-1.5 text-[10px]">Stream Quality</h4>
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

            {/* Audio Compatibility Section (Fix EAC3/AC3 sound) */}
            <div className="border-t border-dark-border pt-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Audio Format</h4>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isTranscodeMode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-700/50 text-gray-400'}`}>
                  {isTranscodeMode ? 'AAC Fixed' : 'Original'}
                </span>
              </div>
              <button
                onClick={handleToggleTranscodeMode}
                className={`w-full py-2 px-2.5 rounded-lg font-medium text-left flex items-center justify-between transition-colors ${
                  isTranscodeMode
                    ? 'bg-emerald-600 text-white'
                    : 'bg-dark-surface hover:bg-dark-hover text-gray-200 border border-white/5'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">
                    {isTranscodeMode ? '✓ AAC Audio Enabled' : '🔊 Fix Audio (Convert to AAC)'}
                  </span>
                  <span className="text-[10px] opacity-80">
                    {isTranscodeMode ? 'Universal browser sound active' : 'Fixes silence on Dolby EAC3/AC3 films'}
                  </span>
                </div>
              </button>
            </div>

            {/* Audio Enhancement Section */}
            <div className="border-t border-dark-border pt-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Audio Boost</h4>
                <button
                  onClick={() => setShowAudioHelp(true)}
                  className="text-brand-400 hover:text-brand-300 text-[10px] flex items-center gap-0.5"
                >
                  <HelpCircle className="w-3 h-3" />
                  No Sound?
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: '100%', val: 1 },
                  { label: '150%', val: 1.5 },
                  { label: '200%', val: 2 },
                ].map((b) => (
                  <button
                    key={b.val}
                    onClick={() => handleAudioBoostChange(b.val)}
                    className={`py-1 rounded text-center font-medium transition-colors ${
                      audioBoost === b.val ? 'bg-brand-500 text-white' : 'bg-dark-surface text-gray-300 hover:bg-dark-hover'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Normalizes 5.1 surround dialogue</p>
            </div>

            {/* Multi-Track Audio Selection (if detected) */}
            {audioTracksList.length > 1 && (
              <div className="border-t border-dark-border pt-2.5">
                <h4 className="font-bold text-gray-400 uppercase tracking-wider mb-1.5 text-[10px]">Audio Track</h4>
                <div className="space-y-1">
                  {audioTracksList.map((tr) => (
                    <button
                      key={tr.index}
                      onClick={() => handleSelectAudioTrack(tr.index)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                        selectedAudioTrack === tr.index ? 'bg-brand-500 text-white' : 'hover:bg-dark-hover text-gray-300'
                      }`}
                    >
                      <span className="truncate">{tr.label}</span>
                      {selectedAudioTrack === tr.index && <Check className="w-3.5 h-3.5 flex-none ml-1" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Speed Control */}
            <div className="border-t border-dark-border pt-2.5">
              <h4 className="font-bold text-gray-400 uppercase tracking-wider mb-1.5 text-[10px]">Playback Speed</h4>
              <div className="grid grid-cols-5 gap-1">
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

            {currentDownloadUrl && (
              <div className="border-t border-dark-border pt-2.5">
                <a
                  href={currentDownloadUrl}
                  download
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-2 bg-dark-surface hover:bg-dark-hover text-emerald-400 rounded-lg font-medium transition-colors text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </a>
              </div>
            )}
          </div>
        </>
      )}

      {/* Audio Troubleshooting Help Modal */}
      {showAudioHelp && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 pointer-events-auto">
          <div className="bg-dark-card border border-dark-border rounded-2xl max-w-sm w-full p-5 text-left shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-500 flex items-center justify-center font-bold text-sm">
                  🔊
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Sound Troubleshooting</h3>
                  <p className="text-gray-400 text-[11px]">Why is there no audio in some movies?</p>
                </div>
              </div>
              <button
                onClick={() => setShowAudioHelp(false)}
                className="text-gray-400 hover:text-white text-sm p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-gray-300">
              {/* 1-Click AAC Audio Fix */}
              <div className="p-3 bg-brand-500/10 border border-brand-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-xs">Instant 1-Click Fix</span>
                  <span className="text-[10px] text-brand-400 font-semibold uppercase">Recommended</span>
                </div>
                <p className="text-gray-300 text-[11px] leading-relaxed">
                  Convert Dolby E-AC-3/AC-3 to universal AAC on the fly so your browser plays full sound immediately.
                </p>
                <button
                  onClick={() => {
                    if (!isTranscodeMode) handleToggleTranscodeMode();
                    setShowAudioHelp(false);
                  }}
                  className="w-full py-2 px-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/25"
                >
                  <span>🔊 {isTranscodeMode ? '✓ AAC Audio Active' : 'Enable AAC Audio (Fix Sound)'}</span>
                </button>
              </div>

              <div className="p-2.5 bg-dark-surface rounded-xl border border-white/5 space-y-1">
                <span className="font-semibold text-white text-xs block">Why this happens</span>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Movies like <em>Shu Thayu</em> are encoded in <strong>Dolby Digital Plus (E-AC-3)</strong>. Web browsers (Chrome, Edge, Firefox) do not license Dolby decoders, muting the sound.
                </p>
              </div>

              <div className="p-2.5 bg-dark-surface rounded-xl border border-white/5 space-y-1">
                <span className="font-semibold text-white text-xs block">Alternative: Play in VLC</span>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Desktop players like <strong>VLC Media Player</strong> natively decode Dolby Atmos, AC3, and DTS tracks.
                </p>
                {currentDownloadUrl && (
                  <a
                    href={currentDownloadUrl}
                    download
                    className="mt-1.5 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-[11px] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Movie for VLC</span>
                  </a>
                )}
              </div>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                onClick={() => setShowAudioHelp(false)}
                className="px-3.5 py-1.5 bg-dark-surface hover:bg-dark-hover text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
          </>
        )}
      </div>

      {/* Stream Source Selector */}
      <div className="bg-dark-card/90 border border-dark-border/80 rounded-xl p-3 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-gray-400 font-medium">Stream Source:</span>
          <span className="text-white font-semibold flex items-center space-x-1.5">
            {streamSource === 'partner' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Cloud Streaming Partner (0 MB Bandwidth)</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>Telegram Bot Server (Direct Upload)</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasPartner && (
            <button
              type="button"
              onClick={() => {
                setStreamError(null);
                setStreamSource('partner');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                streamSource === 'partner'
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'bg-dark-surface text-gray-300 hover:text-white hover:bg-dark-hover border border-white/5'
              }`}
            >
              <span>⚡ Cloud Partner</span>
              <span className="text-[10px] opacity-80 font-normal hidden sm:inline">(Fastest)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setStreamError(null);
              setStreamSource('telegram');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              streamSource === 'telegram'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                : 'bg-dark-surface text-gray-300 hover:text-white hover:bg-dark-hover border border-white/5'
            }`}
          >
            <span>📱 Telegram Server</span>
            <span className="text-[10px] opacity-80 font-normal hidden sm:inline">(Bot File)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
