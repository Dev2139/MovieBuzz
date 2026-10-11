import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import * as dashjs from 'dashjs';
import { attachHevcSupport } from '@hevcjs/dashjs-plugin';
import {
  Play,
  Pause,
  Volume2,
  Volume1,
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
  SkipForward,
  ChevronRight,
  ChevronLeft,
  Subtitles,
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
  subtitles?: Array<{ label: string; language: string; src: string; default?: boolean }>;
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
  subtitles,
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<dashjs.MediaPlayerClass | null>(null);
  const dashHevcCleanupRef = useRef<(() => void) | null>(null);

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
  const [settingsTab, setSettingsTab] = useState<'main' | 'quality' | 'speed' | 'audio'>('main');
  const [bufferedEnd, setBufferedEnd] = useState<number>(0);
  const [scrubberHover, setScrubberHover] = useState<{ isHovering: boolean; percent: number; time: number; x: number }>({
    isHovering: false,
    percent: 0,
    time: 0,
    x: 0,
  });
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [centerFlash, setCenterFlash] = useState<{ type: 'play' | 'pause'; id: number } | null>(null);
  const [showCaptions, setShowCaptions] = useState<boolean>(false);

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

  const updateBuffered = useCallback(() => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const cur = videoRef.current.currentTime;
      for (let i = 0; i < videoRef.current.buffered.length; i++) {
        if (videoRef.current.buffered.start(i) <= cur && cur <= videoRef.current.buffered.end(i)) {
          setBufferedEnd(videoRef.current.buffered.end(i));
          return;
        }
      }
      setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration || duration;
      setCurrentTime(cur);
      if (dur > 0) setDuration(dur);
      updateBuffered();
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
      updateBuffered();
    }
    setIsBuffering(false);
  };

  const togglePlay = () => {
    ensureAudioContext();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setCenterFlash({ type: 'pause', id: Date.now() });
      } else {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
        videoRef.current.play().catch(() => {});
        setCenterFlash({ type: 'play', id: Date.now() });
      }
      setIsPlaying(!isPlaying);
      setTimeout(() => setCenterFlash(null), 500);
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

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickFraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = clickFraction * (duration || 0);
    setCurrentTime(newTime);
    setIsBuffering(true);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = fraction * (duration || 0);
    setScrubberHover({
      isHovering: true,
      percent: fraction * 100,
      time,
      x: e.clientX - rect.left,
    });
  };

  const handleScrubberMouseLeave = () => {
    setScrubberHover((prev) => ({ ...prev, isHovering: false }));
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

  // Container click handler: Left double-click rewind 10s, Right double-click forward 10s, Center double-click pause/play, Single-click toggle controls
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
      // Double Tap Detected
      if (singleClickTimerRef.current) clearTimeout(singleClickTimerRef.current);

      if (clickX < width * 0.35) {
        // Left side double-click: Rewind 10s
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
        }
        setSkipFeedback({ side: 'left', text: '10 seconds', id: Date.now() });
        setTimeout(() => setSkipFeedback(null), 800);
      } else if (clickX > width * 0.65) {
        // Right side double-click: Fast-forward 10s
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
        }
        setSkipFeedback({ side: 'right', text: '10 seconds', id: Date.now() });
        setTimeout(() => setSkipFeedback(null), 800);
      } else {
        // Center double-click: Toggle Pause/Play
        togglePlay();
      }

      lastClickRef.current = { time: 0, x: 0 };
    } else {
      // Single Click: Show / toggle controllers
      lastClickRef.current = { time: now, x: clickX };
      singleClickTimerRef.current = setTimeout(() => {
        setShowControls((prev) => {
          const next = !prev;
          if (next && isPlaying) {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => {
              setShowControls(false);
            }, 3500);
          }
          return next;
        });
      }, 280);
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

  // YouTube Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setShowCaptions((prev) => !prev);
      } else if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.key === 'ArrowLeft' ? 5 : 10;
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - step);
        setSkipFeedback({ side: 'left', text: `-${step}s`, id: Date.now() });
        setTimeout(() => setSkipFeedback(null), 800);
      } else if (e.key === 'l' || e.key === 'L' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.key === 'ArrowRight' ? 5 : 10;
        if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + step);
        setSkipFeedback({ side: 'right', text: `+${step}s`, id: Date.now() });
        setTimeout(() => setSkipFeedback(null), 800);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateVolume(Math.min(1, volume + 0.05), false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateVolume(Math.max(0, volume - 0.05), false);
      } else if (/^[0-9]$/.test(e.key) && duration > 0) {
        e.preventDefault();
        const fraction = parseInt(e.key, 10) / 10;
        const target = fraction * duration;
        if (videoRef.current) videoRef.current.currentTime = target;
        setCurrentTime(target);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration, volume, updateVolume]);

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
    let isCancelled = false;
    const effectiveUrl = getEffectiveStreamUrl(streamUrl, isTranscodeMode);
    if (!videoRef.current || !effectiveUrl) return;

    setIsBuffering(true);
    setStreamError(null);

    // Clean up previous player instances if active
    if (dashHevcCleanupRef.current) {
      dashHevcCleanupRef.current();
      dashHevcCleanupRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (dashRef.current) {
      try {
        dashRef.current.destroy();
      } catch {}
      dashRef.current = null;
    }

    const isDash =
      effectiveUrl.includes('.mpd') ||
      effectiveUrl.includes('/dash/') ||
      activeMedia?.mimeType === 'application/dash+xml' ||
      activeMedia?.format === 'DASH';
    const isHls = !isDash && (effectiveUrl.includes('.m3u8') || effectiveUrl.includes('/hls/'));

    if (isDash) {
      const player = dashjs.MediaPlayer().create();

      const initDash = async () => {
        try {
          const cleanup = await attachHevcSupport(player, {
            forceTranscode: true,
            adaptiveCompute: false,
            bitrate: 4_500_000,
            workerUrl: '/transcode-worker.js',
            wasmUrl: '/hevc-decode.js',
            wasmBinaryUrl: '/hevc-decode.wasm',
          });
          if (isCancelled) {
            cleanup?.();
            try { player.destroy(); } catch {}
            return;
          }
          dashHevcCleanupRef.current = cleanup;
        } catch (err) {
          console.warn('[VideoPlayer] attachHevcSupport notice:', err);
        }

        if (isCancelled || !videoRef.current) {
          try { player.destroy(); } catch {}
          return;
        }

        player.initialize(videoRef.current, effectiveUrl, true);
        dashRef.current = player;
        player.updateSettings({
          streaming: {
            buffer: {
              initialBufferLevel: 1.5,
              bufferTimeDefault: 8,
              bufferTimeAtTopQuality: 16,
              fastSwitchEnabled: true,
            },
            abr: {
              autoSwitchBitrate: {
                video: true,
                audio: true,
              },
            },
          },
        });

        player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
          setIsBuffering(false);
          if (videoRef.current && initialPosition > 0 && !hasAppliedInitialPosRef.current) {
            videoRef.current.currentTime = initialPosition;
            hasAppliedInitialPosRef.current = true;
          }
        });

        player.on(dashjs.MediaPlayer.events.CAN_PLAY, () => {
          setIsBuffering(false);
        });

        player.on(dashjs.MediaPlayer.events.ERROR, (e: any) => {
          console.warn('DASH Player Error event:', e);
        });
      };

      initDash();
    } else if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(effectiveUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        if (videoRef.current && initialPosition > 0 && !hasAppliedInitialPosRef.current) {
          videoRef.current.currentTime = initialPosition;
          hasAppliedInitialPosRef.current = true;
        }
      });

      hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS Network Error, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS Media Error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal HLS Error:', data);
              hls.destroy();
              setStreamError('HLS stream encountered a playback error.');
              setIsBuffering(false);
              setIsPlaying(false);
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (isHls && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple HLS (Safari, iOS)
      videoRef.current.src = effectiveUrl;
      videoRef.current.load();
    } else {
      // Direct MP4 or proxy stream
      videoRef.current.src = effectiveUrl;
      videoRef.current.load();
    }

    return () => {
      isCancelled = true;
      if (dashHevcCleanupRef.current) {
        dashHevcCleanupRef.current();
        dashHevcCleanupRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (dashRef.current) {
        try {
          dashRef.current.destroy();
        } catch {}
        dashRef.current = null;
      }
    };
  }, [streamUrl, isTranscodeMode, initialPosition]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={handleContainerClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full aspect-video bg-black rounded-xl sm:rounded-2xl overflow-hidden group shadow-2xl select-none touch-none"
    >
      <video
        ref={videoRef}
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
      >
        {subtitles &&
          subtitles.map((sub, idx) => (
            <track
              key={idx}
              kind="subtitles"
              label={sub.label}
              srcLang={sub.language}
              src={sub.src}
              default={sub.default}
            />
          ))}
      </video>

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
            <button
              onClick={() => {
                setStreamError(null);
                setIsBuffering(true);
                const effectiveUrl = getEffectiveStreamUrl(streamUrl, isTranscodeMode);
                if (hlsRef.current) {
                  hlsRef.current.loadSource(effectiveUrl);
                  hlsRef.current.startLoad();
                } else if (videoRef.current) {
                  videoRef.current.src = effectiveUrl;
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

      {/* YouTube Double-Tap Curved Feedback Arcs */}
      {skipFeedback?.side === 'left' && (
        <div className="absolute left-0 top-0 bottom-0 w-[38%] bg-white/10 rounded-r-[140px] flex flex-col items-center justify-center text-white z-30 pointer-events-none animate-fade-in backdrop-blur-[2px]">
          <div className="flex items-center space-x-1 mb-1 animate-pulse">
            <RotateCcw className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold tracking-wide text-white drop-shadow">10 seconds</span>
        </div>
      )}
      {skipFeedback?.side === 'right' && (
        <div className="absolute right-0 top-0 bottom-0 w-[38%] bg-white/10 rounded-l-[140px] flex flex-col items-center justify-center text-white z-30 pointer-events-none animate-fade-in backdrop-blur-[2px]">
          <div className="flex items-center space-x-1 mb-1 animate-pulse">
            <RotateCw className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold tracking-wide text-white drop-shadow">10 seconds</span>
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
          <p className="text-[10px] sm:text-[11px] text-[#FF0000] font-semibold uppercase tracking-wider">{selectedQuality} HD Stream</p>
        </div>
      </div>

      {/* YouTube On-Screen Center Controls (Play/Pause & 10s Rewind/Forward) */}
      {showControls && !isBuffering && (
        <div className="absolute inset-0 m-auto flex items-center justify-center space-x-8 sm:space-x-14 z-20 pointer-events-none">
          {/* Rewind 10s */}
          <button
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
              setSkipFeedback({ side: 'left', text: '10 seconds', id: Date.now() });
              setTimeout(() => setSkipFeedback(null), 800);
            }}
            className="no-player-click pointer-events-auto w-10 h-10 sm:w-12 sm:h-12 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white/90 hover:text-white backdrop-blur-md transition-all hover:scale-110 active:scale-95 shadow-xl border border-white/10"
            title="Seek back 10s"
            aria-label="Seek back 10s"
          >
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Center Play / Pause Disc Button */}
          <button
            onClick={togglePlay}
            className="no-player-click pointer-events-auto w-14 h-14 sm:w-16 sm:h-16 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center text-white backdrop-blur-md shadow-2xl transition-all hover:scale-110 active:scale-95 border border-white/15"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-white" />
            ) : (
              <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white ml-0.5 sm:ml-1" />
            )}
          </button>

          {/* Forward 10s */}
          <button
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
              setSkipFeedback({ side: 'right', text: '10 seconds', id: Date.now() });
              setTimeout(() => setSkipFeedback(null), 800);
            }}
            className="no-player-click pointer-events-auto w-10 h-10 sm:w-12 sm:h-12 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white/90 hover:text-white backdrop-blur-md transition-all hover:scale-110 active:scale-95 shadow-xl border border-white/10"
            title="Seek forward 10s"
            aria-label="Seek forward 10s"
          >
            <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      )}

      {/* Center Animated Flash Indicator (YouTube style on play/pause) */}
      {centerFlash && (
        <div
          key={centerFlash.id}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/70 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-2xl animate-ping opacity-75">
            {centerFlash.type === 'play' ? (
              <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1" />
            ) : (
              <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-white" />
            )}
          </div>
        </div>
      )}

      {/* YouTube-Style Controls Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 z-30 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* YouTube Scrubber Progress Bar */}
        <div
          className="relative w-full group/scrub py-2 sm:py-3 px-3 sm:px-4 cursor-pointer no-player-click select-none"
          onClick={handleScrubberClick}
          onMouseMove={handleScrubberMouseMove}
          onMouseLeave={handleScrubberMouseLeave}
        >
          {/* Floating Time Tooltip */}
          {scrubberHover.isHovering && duration > 0 && (
            <div
              className="absolute -top-7 -translate-x-1/2 bg-[#1f1f1f]/95 backdrop-blur-md text-white font-sans text-[11px] font-semibold px-2 py-0.5 rounded shadow-xl pointer-events-none border border-white/10 whitespace-nowrap z-40"
              style={{ left: `${Math.max(20, Math.min(scrubberHover.x + 12, (containerRef.current?.clientWidth || 400) - 20))}px` }}
            >
              {formatTime(scrubberHover.time)}
            </div>
          )}

          {/* Track Container */}
          <div className="h-[3px] group-hover/scrub:h-[5px] transition-all bg-white/20 w-full relative flex items-center rounded-none overflow-visible">
            {/* Buffer Track */}
            <div
              className="absolute left-0 top-0 h-full bg-white/40 transition-all duration-150"
              style={{ width: `${duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0}%` }}
            />

            {/* Hover Ghost Track */}
            {scrubberHover.isHovering && (
              <div
                className="absolute left-0 top-0 h-full bg-white/25"
                style={{ width: `${scrubberHover.percent}%` }}
              />
            )}

            {/* Played Track (YouTube Red) */}
            <div
              className="absolute left-0 top-0 h-full bg-[#FF0000] relative"
              style={{ width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
            >
              {/* YouTube Red Scrubber Thumb (Circle) */}
              <div className="absolute -top-[4px] -right-[6px] w-3 h-3 sm:w-3.5 sm:h-3.5 bg-[#FF0000] rounded-full scale-0 group-hover/scrub:scale-100 transition-transform duration-100 shadow-[0_0_6px_rgba(255,0,0,0.8)]" />
            </div>
          </div>
        </div>

        {/* YouTube Bottom Controls Bar */}
        <div className="px-3 sm:px-4 pb-2.5 pt-0.5 flex items-center justify-between text-white select-none no-player-click">
          {/* Left Controls: Play/Pause, Next, Volume with Expandable Slider, Timestamp */}
          <div className="flex items-center space-x-1 sm:space-x-3 min-w-0">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-1 sm:p-1.5 text-white/90 hover:text-white transition-opacity flex-none"
              title={isPlaying ? 'Pause (k)' : 'Play (k)'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white ml-0.5" />
              )}
            </button>

            {/* Next Video / Seek Forward */}
            <button
              onClick={() => {
                if (onEnded) onEnded();
                else if (videoRef.current) {
                  videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
                }
              }}
              className="p-1 sm:p-1.5 text-white/90 hover:text-white transition-opacity flex-none"
              title={onEnded ? 'Next episode (Shift+N)' : 'Seek forward 10s'}
              aria-label="Next Video"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
            </button>

            {/* YouTube Expandable Volume Slider Group */}
            <div className="group/vol flex items-center relative flex-none">
              <button
                onClick={toggleMute}
                className="p-1 sm:p-1.5 text-white/90 hover:text-white transition-opacity flex-none"
                title={isMuted || volume === 0 ? 'Unmute (m)' : 'Mute (m)'}
                aria-label="Toggle mute"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-red-500" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                ) : (
                  <Volume2 className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                )}
              </button>
              <div className="w-0 group-hover/vol:w-16 sm:group-hover/vol:w-20 transition-all duration-200 overflow-hidden flex items-center ml-1">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-14 sm:w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[#FF0000]"
                  aria-label="Volume slider"
                />
              </div>
            </div>

            {/* YouTube Timestamp */}
            <div className="text-xs sm:text-[13px] text-white/90 font-sans tracking-tight ml-1.5 select-none whitespace-nowrap">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-white/60">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls: CC, Settings, PiP, Fullscreen */}
          <div className="flex items-center space-x-1 sm:space-x-2 relative flex-none">
            {/* Closed Captions (CC) */}
            <button
              onClick={() => setShowCaptions(!showCaptions)}
              className={`p-1 sm:p-1.5 relative transition-colors ${
                showCaptions ? 'text-white' : 'text-white/60 hover:text-white/90'
              }`}
              title="Subtitles/closed captions (c)"
              aria-label="Subtitles"
            >
              <span className="font-bold border border-current text-[10px] sm:text-xs px-1 rounded-sm leading-none flex items-center h-4 sm:h-4.5">
                CC
              </span>
              {showCaptions && (
                <span className="absolute bottom-0.5 left-1 right-1 h-[2px] bg-[#FF0000] rounded-full" />
              )}
            </button>

            {/* YouTube Settings Gear Button */}
            <button
              onClick={() => {
                setShowSettings(!showSettings);
                setSettingsTab('main');
              }}
              className={`p-1 sm:p-1.5 hover:text-white transition-all flex-none ${
                showSettings ? 'rotate-45 text-white' : 'text-white/90 hover:rotate-45'
              }`}
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
            </button>

            {/* Picture in Picture */}
            <button
              onClick={togglePictureInPicture}
              className="p-1 sm:p-1.5 text-white/90 hover:text-white transition-opacity hidden sm:block flex-none"
              title="Miniplayer (i)"
              aria-label="Picture in Picture"
            >
              <Tv className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1 sm:p-1.5 text-white/90 hover:text-white transition-opacity flex-none"
              title={isFullscreen ? 'Exit full screen (f)' : 'Full screen (f)'}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              ) : (
                <Maximize className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* YouTube-Style Settings Floating Popover Menu */}
      {showSettings && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowSettings(false);
              setSettingsTab('main');
            }}
          />

          <div className="absolute right-3 sm:right-4 bottom-14 w-64 bg-[#1f1f1f]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 text-xs sm:text-[13px] text-white font-sans no-player-click animate-fade-in overflow-hidden">
            {settingsTab === 'main' && (
              <div className="space-y-0.5">
                {/* Quality Item */}
                <button
                  onClick={() => setSettingsTab('quality')}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center space-x-2.5">
                    <Film className="w-4 h-4 text-white/80" />
                    <span className="text-white/90 font-medium">Quality</span>
                  </div>
                  <div className="flex items-center space-x-1 text-white/60 text-[11px]">
                    <span>{selectedQuality}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Speed Item */}
                <button
                  onClick={() => setSettingsTab('speed')}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center space-x-2.5">
                    <RotateCw className="w-4 h-4 text-white/80" />
                    <span className="text-white/90 font-medium">Playback speed</span>
                  </div>
                  <div className="flex items-center space-x-1 text-white/60 text-[11px]">
                    <span>{playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Audio Enhancements / Format */}
                <button
                  onClick={() => setSettingsTab('audio')}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center space-x-2.5">
                    <Volume2 className="w-4 h-4 text-white/80" />
                    <span className="text-white/90 font-medium">Audio & Sound</span>
                  </div>
                  <div className="flex items-center space-x-1 text-white/60 text-[11px]">
                    <span>{isTranscodeMode ? 'AAC Fixed' : `${audioBoost * 100}%`}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Download File if available */}
                {currentDownloadUrl && (
                  <div className="pt-1 mt-1 border-t border-white/10">
                    <a
                      href={currentDownloadUrl}
                      download
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-lg text-emerald-400 transition-colors"
                    >
                      <div className="flex items-center space-x-2.5">
                        <Download className="w-4 h-4" />
                        <span className="font-medium">Download file</span>
                      </div>
                      <span className="text-[10px] text-emerald-400/80">Direct</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {settingsTab === 'quality' && (
              <div>
                <button
                  onClick={() => setSettingsTab('main')}
                  className="w-full flex items-center space-x-2 px-3 py-2 border-b border-white/10 text-white/80 hover:text-white transition-colors text-left font-semibold"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Quality</span>
                </button>
                <div className="py-1 max-h-56 overflow-y-auto space-y-0.5">
                  {mediaList && mediaList.length > 0 ? (
                    mediaList.map((m) => (
                      <button
                        key={m._id}
                        onClick={() => {
                          handleQualityChange(m.quality);
                          setShowSettings(false);
                          setSettingsTab('main');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left ${
                          selectedQuality === m.quality ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 text-white/80'
                        }`}
                      >
                        <span>{m.quality} ({m.resolution})</span>
                        {selectedQuality === m.quality && <Check className="w-3.5 h-3.5 text-[#FF0000]" />}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-white/60">1080p Standard</div>
                  )}
                </div>
              </div>
            )}

            {settingsTab === 'speed' && (
              <div>
                <button
                  onClick={() => setSettingsTab('main')}
                  className="w-full flex items-center space-x-2 px-3 py-2 border-b border-white/10 text-white/80 hover:text-white transition-colors text-left font-semibold"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Playback speed</span>
                </button>
                <div className="py-1 max-h-56 overflow-y-auto space-y-0.5">
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((sp) => (
                    <button
                      key={sp}
                      onClick={() => {
                        handleSpeedChange(sp);
                        setShowSettings(false);
                        setSettingsTab('main');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left ${
                        playbackSpeed === sp ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 text-white/80'
                      }`}
                    >
                      <span>{sp === 1 ? 'Normal' : `${sp}x`}</span>
                      {playbackSpeed === sp && <Check className="w-3.5 h-3.5 text-[#FF0000]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {settingsTab === 'audio' && (
              <div className="space-y-2">
                <button
                  onClick={() => setSettingsTab('main')}
                  className="w-full flex items-center space-x-2 px-3 py-2 border-b border-white/10 text-white/80 hover:text-white transition-colors text-left font-semibold"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Audio & Sound</span>
                </button>

                {/* 1-Click AAC Audio fix */}
                <div className="px-1">
                  <button
                    onClick={handleToggleTranscodeMode}
                    className={`w-full p-2.5 rounded-lg text-left transition-colors flex items-center justify-between ${
                      isTranscodeMode
                        ? 'bg-emerald-600/90 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-white/90 border border-white/10'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">{isTranscodeMode ? '✓ AAC Audio Active' : 'Convert to AAC'}</div>
                      <div className="text-[10px] text-white/60">Fixes silent Dolby E-AC-3 sound</div>
                    </div>
                  </button>
                </div>

                {/* Audio Boost */}
                <div className="px-1 pt-1 border-t border-white/10">
                  <span className="text-[11px] text-white/60 block mb-1.5 font-medium">Audio Boost</span>
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
                          audioBoost === b.val ? 'bg-[#FF0000] text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audio Tracks */}
                {audioTracksList.length > 1 && (
                  <div className="px-1 pt-1 border-t border-white/10">
                    <span className="text-[11px] text-white/60 block mb-1 font-medium">Audio Track</span>
                    <div className="space-y-0.5">
                      {audioTracksList.map((tr) => (
                        <button
                          key={tr.index}
                          onClick={() => handleSelectAudioTrack(tr.index)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                            selectedAudioTrack === tr.index ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 text-white/80'
                          }`}
                        >
                          <span className="truncate">{tr.label}</span>
                          {selectedAudioTrack === tr.index && <Check className="w-3 h-3 text-[#FF0000]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
    </div>
  );
};
