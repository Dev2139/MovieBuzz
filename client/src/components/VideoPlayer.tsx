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
  ExternalLink,
  X,
  Globe,
  Languages,
} from 'lucide-react';
import { Media } from '../types';
import { useAuth } from '../context/AuthContext';
import { saveLocalPlaybackPosition } from '../utils/localStorage';
import { resolveMediaUrl } from '../utils/url';
import { saveWatchProgress, fetchSubtitles } from '../services/api';

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
  subtitles?: Array<{ id?: string; label: string; language: string; src: string; default?: boolean }>;
  dubs?: Array<{ subjectId: string; name: string; code: string; original?: boolean }>;
}

export const QUALITY_TIERS = [
  { label: 'Auto (Adaptive)', value: 'auto', badge: 'Auto', height: 0, description: 'Best adaptive print for your speed' },
  { label: '420p (Standard)', value: '420p', badge: 'Fastest', height: 420, description: 'Zero buffering & instant rendering' },
  { label: '720p (HD)', value: '720p', badge: 'HD', height: 720, description: 'Crisp High Definition print' },
  { label: '1080p (Full HD)', value: '1080p', badge: 'Full HD', height: 1080, description: 'Crystal clear 1080p theatrical print' },
  { label: '2160p (Ultra HD)', value: '2160p', badge: 'Ultra HD', height: 2160, description: '2160p Master Quality' },
  { label: '4K (Cinema 4K)', value: '4k', badge: '4K Cinema', height: 2160, description: 'Master 4K Cinema Print' },
];

export interface AudioTrackOption {
  code: string;
  label: string;
  detail: string;
  subjectId?: string;
  original?: boolean;
}

export const PRESET_AUDIO_LANGUAGES: AudioTrackOption[] = [
  { code: 'en', label: 'Original', detail: 'Original (AAC Stereo)' },
  { code: 'hi', label: 'Hindi (हिंदी)', detail: 'Dubbed (5.1 HD)' },
  { code: 'es', label: 'Spanish (Español)', detail: 'Castellano / Latino' },
  { code: 'fr', label: 'French (Français)', detail: 'Doublé' },
  { code: 'ja', label: 'Japanese (日本語)', detail: 'Original / Dub' },
  { code: 'de', label: 'German (Deutsch)', detail: 'Synchron' },
  { code: 'ta', label: 'Tamil (தமிழ்)', detail: 'Dubbed' },
  { code: 'te', label: 'Telugu (తెలుగు)', detail: 'Dubbed' },
];

export const PRESET_SUBTITLE_LANGUAGES = [
  { code: 'off', label: 'Off', detail: 'Captions disabled' },
  { code: 'en', label: 'English (CC)', detail: 'Closed captions' },
  { code: 'hi', label: 'Hindi (हिंदी)', detail: 'सबटाइटल' },
  { code: 'es', label: 'Spanish (Español)', detail: 'Subtítulos' },
  { code: 'fr', label: 'French (Français)', detail: 'Sous-titres' },
  { code: 'ar', label: 'Arabic (العربية)', detail: 'ترجمة' },
  { code: 'ja', label: 'Japanese (日本語)', detail: '字幕' },
  { code: 'de', label: 'German (Deutsch)', detail: 'Untertitel' },
];

function parseVttTimestamp(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().split(' ')[0].replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
  } else if (parts.length === 2) {
    const [m, s] = parts;
    return parseFloat(m) * 60 + parseFloat(s);
  }
  return 0;
}

function parseVtt(vttString: string): Array<{ start: number; end: number; text: string }> {
  const cues: Array<{ start: number; end: number; text: string }> = [];
  if (!vttString) return cues;
  const cleanVtt = vttString.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanVtt.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map((s) => s.trim());
      const start = parseVttTimestamp(startStr);
      const end = parseVttTimestamp(endStr);
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        let cleanText = lines[i]
          .replace(/<\/?[^>]+(>|$)/g, '')
          .replace(/\{[^}]+\}/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/\\N/g, '\n')
          .replace(/\\n/g, '\n')
          .trim();
        if (cleanText && cleanText !== '_') {
          textLines.push(cleanText);
        }
        i++;
      }
      if (textLines.length > 0 && end > start) {
        cues.push({ start, end, text: textLines.join('\n') });
      }
    } else {
      i++;
    }
  }
  return cues;
}

// Helper function to check if browser/device supports hardware HEVC natively without WASM software penalty
function checkNativeHevcSupport(): boolean {
  if (typeof window === 'undefined') return false;
  // Apple devices (Safari, iOS WebKit) natively decode HEVC via hardware VideoToolbox
  if (/Macintosh|iPhone|iPad|iPod/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent)) {
    return true;
  }
  // Check MediaSource MSE support for common HEVC/H.265 codec identifiers (Chromium 107+, Android hardware decode)
  if (typeof window.MediaSource !== 'undefined' && typeof window.MediaSource.isTypeSupported === 'function') {
    const hevcCodecs = [
      'video/mp4; codecs="hev1.1.6.L93.B0"',
      'video/mp4; codecs="hvc1.1.6.L93.B0"',
      'video/mp4; codecs="hev1.1.6.L120.90"',
      'video/mp4; codecs="hvc1.1.6.L120.90"',
      'video/mp4; codecs="hevc,mp4a.40.2"',
      'video/mp4; codecs="hevc"',
      'video/mp4; codecs="hvc1"',
      'video/mp4; codecs="hev1"',
    ];
    if (hevcCodecs.some((codec) => window.MediaSource.isTypeSupported(codec))) {
      return true;
    }
  }
  // Check HTMLMediaElement canPlayType
  if (typeof document !== 'undefined') {
    const v = document.createElement('video');
    if (v.canPlayType) {
      if (
        v.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') === 'probably' ||
        v.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') === 'probably' ||
        v.canPlayType('video/mp4; codecs="hevc"') === 'probably'
      ) {
        return true;
      }
    }
  }
  return false;
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
  subtitles,
  dubs = [],
}) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<dashjs.MediaPlayerClass | null>(null);
  const dashHevcCleanupRef = useRef<(() => void) | null>(null);
  const autoRetryAttemptsRef = useRef<number>(0);
  const isRetryingRef = useRef<boolean>(false);
  const playbackPositionRef = useRef<number>(initialPosition || 0);
  const wasPlayingBeforeHiddenRef = useRef<boolean>(false);
  const hasAppliedInitialPosRef = useRef<boolean>(false);
  const shouldAutoResumeAfterQualitySwitchRef = useRef<boolean>(false);
  // Background buffer keeper: keeps HLS/DASH loading chunks even while paused or during ads
  const bgBufferIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Device-adaptive streaming profile ---
  // Detect mobile / low-memory environments to tune buffer sizes and ABR aggressiveness.
  const isMobileDevice = React.useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(ua);
    // navigator.deviceMemory is available in Chrome/Edge; treat < 4 GB as low-memory
    const lowMemory = typeof (navigator as any).deviceMemory === 'number' && (navigator as any).deviceMemory < 4;
    // Connection-aware: treat 2G / slow-3G as constrained
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const slowConn = conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.saveData === true);
    return isMobileUA || lowMemory || !!slowConn;
  }, []);

  // Streaming profile derived from device class - tuned for instant 0.3s startup and continuous aggressive buffering
  const streamingProfile = React.useMemo(() => {
    if (isMobileDevice) {
      return {
        // HLS
        hlsMaxBufferLength: 300,             // 5 minutes buffer horizon ahead while playing
        hlsMaxMaxBufferLength: 600,         // 10 minutes max limit
        hlsMaxBufferSize: 160 * 1000 * 1000,// 160 MB buffer RAM
        hlsBackBufferLength: 45,            // trim 45s behind playhead to protect mobile MSE memory quota
        hlsStartLevel: -1,                  // ABR picks optimal quality
        hlsMaxFragLookUpTolerance: 0.25,
        hlsLowLatencyMode: false,
        // DASH
        dashInitialBufferLevel: 0.3,        // Start playback in ~300ms! (was 1.2s!) Ultra-low startup threshold
        dashBufferTimeDefault: 300,         // Maintain 5 minutes of chunks in advance while playing
        dashBufferTimeAtTopQuality: 450,
        dashBufferTimeAtTopQualityLongForm: 600,
        dashInitialBitrate: 800,            // Start snappy at 800 kbps for instant first segment download on cellular
        dashBufferToKeep: 45,               // Safe mobile memory management
        dashBufferPruningInterval: 30,
      };
    }
    // Desktop / high-memory profile — ultra-fast aggressive buffering
    return {
      hlsMaxBufferLength: 1200,            // 20 minutes buffer horizon while playing (was 240s)
      hlsMaxMaxBufferLength: 2400,         // 40 minutes max
      hlsMaxBufferSize: 600 * 1000 * 1000, // 600 MB buffer RAM
      hlsBackBufferLength: 300,
      hlsStartLevel: -1,
      hlsMaxFragLookUpTolerance: 0.2,
      hlsLowLatencyMode: false,
      dashInitialBufferLevel: 0.4,         // Start playback in ~400ms! (was 1.8s!)
      dashBufferTimeDefault: 1200,         // Maintain 20 minutes of chunks in advance
      dashBufferTimeAtTopQuality: 1500,
      dashBufferTimeAtTopQualityLongForm: 1800,
      dashInitialBitrate: 2000,
      dashBufferToKeep: 600,
      dashBufferPruningInterval: 120,
    };
  }, [isMobileDevice]);

  const [subtitleSize, setSubtitleSize] = useState<'small' | 'medium' | 'large' | 'extralarge'>(() => {
    try {
      const saved = localStorage.getItem('moviebuzz_sub_size');
      if (saved && ['small', 'medium', 'large', 'extralarge'].includes(saved)) {
        return saved as any;
      }
    } catch {}
    return 'medium';
  });

  const [dashQualities, setDashQualities] = useState<
    Array<{
      index: number;
      qualityIndex: number;
      height: number;
      width: number;
      bitrate: number;
      label: string;
      badge: string;
      value: string;
    }>
  >([]);

  const [hlsQualities, setHlsQualities] = useState<
    Array<{
      index: number;
      height: number;
      width: number;
      bitrate: number;
      label: string;
      badge: string;
      value: string;
    }>
  >([]);

  const [activeRenderedResolution, setActiveRenderedResolution] = useState<string>('');

  const getResponsiveSubtitleFontSize = (size: 'small' | 'medium' | 'large' | 'extralarge') => {
    switch (size) {
      case 'small':
        return 'clamp(12px, 1.8vw, 20px)';
      case 'large':
        return 'clamp(18px, 3.0vw, 36px)';
      case 'extralarge':
        return 'clamp(22px, 3.8vw, 44px)';
      case 'medium':
      default:
        return 'clamp(15px, 2.4vw, 28px)';
    }
  };

  const [selectedQuality, setSelectedQuality] = useState<string>(
    mediaList && mediaList.length > 0 ? mediaList[0].quality : '1080p'
  );
  const [selectedAudioLang, setSelectedAudioLang] = useState<string>('en');
  const [streamUrl, setStreamUrl] = useState<string>(
    resolveMediaUrl(mediaList && mediaList.length > 0 ? mediaList[0].streamUrl : undefined)
  );

  const activeMedia = mediaList && mediaList.length > 0
    ? (mediaList.find((m) => {
        const matchesAudio =
          !selectedAudioLang ||
          m.audioLang?.toLowerCase() === selectedAudioLang.toLowerCase() ||
          (selectedAudioLang === 'en' && (m.isOriginal || m.audioLang === 'en'));
        if (!matchesAudio) return false;
        const lower = selectedQuality.toLowerCase();
        const q = (m.quality || '').toLowerCase();
        if (lower === '4k' || lower === '2160p') return q.includes('4k') || q.includes('2160');
        if (lower === '1080p') return q.includes('1080');
        if (lower === '720p') return q.includes('720');
        if (lower === '420p') return q.includes('420') || q.includes('480') || q.includes('360');
        return q === lower;
      }) ||
      mediaList.find((m) =>
        m.audioLang?.toLowerCase() === selectedAudioLang.toLowerCase() ||
        (selectedAudioLang === 'en' && (m.isOriginal || m.audioLang === 'en'))
      ) ||
      mediaList[0])
    : null;
  const currentDownloadUrl = resolveMediaUrl(activeMedia?.downloadUrl);

  useEffect(() => {
    if (mediaList && mediaList.length > 0) {
      const lower = selectedQuality.toLowerCase();
      const found =
        mediaList.find((m) => {
          const matchesAudio =
            !selectedAudioLang ||
            m.audioLang?.toLowerCase() === selectedAudioLang.toLowerCase() ||
            (selectedAudioLang === 'en' && (m.isOriginal || m.audioLang === 'en'));
          if (!matchesAudio) return false;
          const q = (m.quality || '').toLowerCase();
          if (lower === '4k' || lower === '2160p') return q.includes('4k') || q.includes('2160');
          if (lower === '1080p') return q.includes('1080');
          if (lower === '720p') return q.includes('720');
          if (lower === '420p') return q.includes('420') || q.includes('480') || q.includes('360');
          return q === lower;
        }) ||
        mediaList.find((m) =>
          m.audioLang?.toLowerCase() === selectedAudioLang.toLowerCase() ||
          (selectedAudioLang === 'en' && (m.isOriginal || m.audioLang === 'en'))
        ) ||
        mediaList[0];
      const resolved = resolveMediaUrl(found.streamUrl);
      if (resolved && resolved !== streamUrl) {
        setStreamUrl(resolved);
        setStreamError(null);
      }
    }
  }, [mediaList, selectedQuality, selectedAudioLang, streamUrl]);

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
  const [settingsTab, setSettingsTab] = useState<'main' | 'quality' | 'speed' | 'audio' | 'language'>('main');
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
  const [selectedSubtitleLang, setSelectedSubtitleLang] = useState<string>('off');

  // Dynamic Audio Track & Dubbing Options based on MovieBox dub catalog and sources
  const availableAudioOptions = React.useMemo(() => {
    const list: Array<{ code: string; label: string; detail: string; subjectId?: string; original?: boolean }> = [];
    const seenCodes = new Set<string>();

    // 1. Dub Catalog
    if (dubs && dubs.length > 0) {
      dubs.forEach((d) => {
        const code = d.code?.toLowerCase() || 'en';
        if (!seenCodes.has(code)) {
          seenCodes.add(code);
          list.push({
            code,
            label: d.name || (code === 'en' ? 'Original Audio' : `${code.toUpperCase()} Dub`),
            detail: d.original ? 'Original Audio' : 'Dubbed Audio',
            subjectId: d.subjectId,
            original: d.original,
          });
        }
      });
    }

    // 2. Sources in mediaList tagged with audio
    if (mediaList && mediaList.length > 0) {
      mediaList.forEach((m) => {
        if (m.audioLang) {
          const code = m.audioLang.toLowerCase();
          if (!seenCodes.has(code)) {
            seenCodes.add(code);
            list.push({
              code,
              label: m.audioName || (code === 'en' ? 'Original Audio' : `${code.toUpperCase()} Dub`),
              detail: m.isOriginal ? 'Original Audio' : 'Dubbed Audio',
              subjectId: m.dubSubjectId,
              original: m.isOriginal,
            });
          }
        }
      });
    }

    // 3. Embedded Dash/HLS tracks
    if (audioTracksList && audioTracksList.length > 0) {
      audioTracksList.forEach((t) => {
        const code = (t.language || `track-${t.index}`).toLowerCase();
        if (!seenCodes.has(code)) {
          seenCodes.add(code);
          list.push({
            code,
            label: t.label,
            detail: 'Embedded Audio',
          });
        }
      });
    }

    if (list.length === 0) {
      return PRESET_AUDIO_LANGUAGES;
    }

    return list;
  }, [dubs, mediaList, audioTracksList]);
  // Auto-fetch fallback subtitles if not explicitly passed by parent
  const [autoFetchedSubtitles, setAutoFetchedSubtitles] = useState<
    Array<{ id: string; label: string; language: string; src: string; default?: boolean }>
  >([]);

  useEffect(() => {
    if (subtitles && subtitles.length > 0) return;
    if (!contentTitle && !imdbId && !tmdbId) return;

    fetchSubtitles({
      imdbId,
      tmdbId,
      title: contentTitle,
      type: contentType as any,
      season: seasonNumber,
      episode: episodeNumber,
    })
      .then((res) => {
        if (res?.subtitles?.length) {
          setAutoFetchedSubtitles(res.subtitles);
        }
      })
      .catch(() => {});
  }, [subtitles, contentTitle, imdbId, tmdbId, contentType, seasonNumber, episodeNumber]);

  const effectiveSubtitles = React.useMemo(() => {
    if (subtitles && subtitles.length > 0) return subtitles;
    return autoFetchedSubtitles;
  }, [subtitles, autoFetchedSubtitles]);

  // Dynamic Subtitle Options list
  const availableSubtitles = React.useMemo(() => {
    const list: Array<{ code: string; label: string; detail: string; src?: string }> = [
      { code: 'off', label: 'Off', detail: 'Captions disabled' },
    ];
    if (effectiveSubtitles && effectiveSubtitles.length > 0) {
      effectiveSubtitles.forEach((s) => {
        list.push({
          code: s.language,
          label: s.label.includes('(') ? s.label : `${s.label} (${s.language.toUpperCase()})`,
          detail: s.label,
          src: s.src,
        });
      });
    } else {
      PRESET_SUBTITLE_LANGUAGES.filter((p) => p.code !== 'off').forEach((p) => list.push(p));
    }
    return list;
  }, [effectiveSubtitles]);

  // Floating toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  }, []);

  // Subtitle WebVTT parsing & current cue tracking
  const [activeVttCues, setActiveVttCues] = useState<Array<{ start: number; end: number; text: string }>>([]);
  const activeVttCuesRef = useRef<Array<{ start: number; end: number; text: string }>>([]);
  const [currentCueText, setCurrentCueText] = useState<string>('');
  const currentCueTextRef = useRef<string>('');
  const userManuallyToggledCaptionsRef = useRef<boolean>(false);

  // Sync HTML5 textTracks mode
  const syncSubtitles = useCallback((langCode: string, enabled: boolean) => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    if (tracks && tracks.length > 0) {
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (
          enabled &&
          langCode !== 'off' &&
          (track.language?.toLowerCase().startsWith(langCode.toLowerCase()) ||
            track.label?.toLowerCase().includes(langCode.toLowerCase()) ||
            langCode.toLowerCase().startsWith(track.language?.toLowerCase()))
        ) {
          // If custom cues are parsed, hide native track to prevent double rendering; otherwise show native
          track.mode = activeVttCuesRef.current.length > 0 ? 'hidden' : 'showing';
        } else {
          track.mode = 'disabled';
        }
      }
    }
  }, []);

  // Auto-enable subtitles by default once tracks are available (unless user explicitly turned them off)
  useEffect(() => {
    if (userManuallyToggledCaptionsRef.current) return;
    if (!effectiveSubtitles || effectiveSubtitles.length === 0) return;

    if (selectedSubtitleLang === 'off' || !showCaptions) {
      const defaultSub =
        effectiveSubtitles.find((s) => s.default) ||
        effectiveSubtitles.find(
          (s) => s.language?.toLowerCase() === 'en' || s.language?.toLowerCase().startsWith('en')
        ) ||
        effectiveSubtitles[0];

      if (defaultSub) {
        const lang = defaultSub.language || 'en';
        setSelectedSubtitleLang(lang);
        setShowCaptions(true);
        syncSubtitles(lang, true);
        showToast(`Subtitles Enabled: ${defaultSub.label || 'English'}`);
      }
    }
  }, [effectiveSubtitles, selectedSubtitleLang, showCaptions, syncSubtitles, showToast]);

  // Fetch and parse WebVTT file for active subtitle language
  useEffect(() => {
    if (!showCaptions || selectedSubtitleLang === 'off') {
      setActiveVttCues([]);
      activeVttCuesRef.current = [];
      currentCueTextRef.current = '';
      setCurrentCueText('');
      return;
    }

    const matched =
      effectiveSubtitles.find(
        (s) =>
          (s.id && s.id === selectedSubtitleLang) ||
          (s.language && s.language.toLowerCase() === selectedSubtitleLang.toLowerCase()) ||
          (s.language && s.language.toLowerCase().startsWith(selectedSubtitleLang.toLowerCase())) ||
          (s.language && selectedSubtitleLang.toLowerCase().startsWith(s.language.toLowerCase())) ||
          (s.label && s.label.toLowerCase() === selectedSubtitleLang.toLowerCase()) ||
          (selectedSubtitleLang.toLowerCase().startsWith('en') &&
            (s.language?.toLowerCase().startsWith('en') || s.label?.toLowerCase().includes('english')))
      ) ||
      effectiveSubtitles.find((s) => s.default) ||
      effectiveSubtitles[0];

    if (!matched?.src) return;

    let resolvedSrc = resolveMediaUrl(matched.src);
    // Leverage Vite same-origin proxy in local development to eliminate any browser CORS hurdles
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      if (resolvedSrc.includes('/api/streaming/')) {
        resolvedSrc = resolvedSrc.substring(resolvedSrc.indexOf('/api/streaming/'));
      }
    }

    let cancelled = false;

    fetch(resolvedSrc)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((vttText) => {
        if (!cancelled && vttText) {
          const cues = parseVtt(vttText);
          setActiveVttCues(cues);
          activeVttCuesRef.current = cues;
          syncSubtitles(selectedSubtitleLang, true);

          // Immediately check current playback position for instantaneous display
          if (videoRef.current) {
            const nowTime = videoRef.current.currentTime;
            const match = cues.find((c) => nowTime >= c.start && nowTime <= c.end);
            if (match) {
              currentCueTextRef.current = match.text;
              setCurrentCueText(match.text);
            }
          }
        }
      })
      .catch((err) => {
        console.warn('[VideoPlayer] Subtitle VTT fetch notice:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [showCaptions, selectedSubtitleLang, effectiveSubtitles, syncSubtitles]);

  // Track active subtitle cue based on currentTime
  useEffect(() => {
    if (!showCaptions || selectedSubtitleLang === 'off') {
      currentCueTextRef.current = '';
      setCurrentCueText('');
      return;
    }

    const cues = activeVttCuesRef.current.length > 0 ? activeVttCuesRef.current : activeVttCues;
    if (cues.length > 0) {
      const pos = currentTime;
      const match = cues.find((c) => pos >= c.start && pos <= c.end);
      const nextText = match ? match.text : '';
      if (nextText !== currentCueTextRef.current) {
        currentCueTextRef.current = nextText;
        setCurrentCueText(nextText);
      }
    }
  }, [currentTime, showCaptions, selectedSubtitleLang, activeVttCues]);

  // Fallback: Listen to native HTML5 textTrack cuechange events
  useEffect(() => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    if (!tracks || tracks.length === 0) return;

    const onCueChange = () => {
      if (!showCaptions || selectedSubtitleLang === 'off') return;
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (t.mode !== 'disabled' && t.activeCues && t.activeCues.length > 0) {
          const texts: string[] = [];
          for (let c = 0; c < t.activeCues.length; c++) {
            const cue = t.activeCues[c] as any;
            if (cue && cue.text) {
              texts.push(cue.text.replace(/<\/?[^>]+(>|$)/g, '').trim());
            }
          }
          const clean = texts.join('\n').trim();
          if (clean && clean !== currentCueTextRef.current) {
            currentCueTextRef.current = clean;
            setCurrentCueText(clean);
            return;
          }
        }
      }
    };

    for (let i = 0; i < tracks.length; i++) {
      tracks[i].addEventListener('cuechange', onCueChange);
    }

    return () => {
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].removeEventListener('cuechange', onCueChange);
      }
    };
  }, [showCaptions, selectedSubtitleLang]);



  useEffect(() => {
    syncSubtitles(selectedSubtitleLang, showCaptions);
  }, [showCaptions, selectedSubtitleLang, syncSubtitles]);

  const toggleCaptions = useCallback(() => {
    if (showCaptions) {
      userManuallyToggledCaptionsRef.current = true;
      setShowCaptions(false);
      setSelectedSubtitleLang('off');
      syncSubtitles('', false);
      currentCueTextRef.current = '';
      setCurrentCueText('');
      showToast('Captions OFF');
    } else {
      userManuallyToggledCaptionsRef.current = false;
      setShowCaptions(true);
      const defaultOption =
        availableSubtitles.find((s) => s.code === 'en') ||
        availableSubtitles.find((s) => s.code !== 'off');
      const nextLang = defaultOption?.code || 'en';
      setSelectedSubtitleLang(nextLang);
      syncSubtitles(nextLang, true);
      showToast(`Captions ON: ${defaultOption?.label || 'English (CC)'}`);

      // Immediately check current playback position for instantaneous subtitle display
      if (videoRef.current) {
        const cur = videoRef.current.currentTime;
        const cues = activeVttCuesRef.current.length > 0 ? activeVttCuesRef.current : activeVttCues;
        if (cues.length > 0) {
          const match = cues.find((c) => cur >= c.start && cur <= c.end);
          if (match) {
            currentCueTextRef.current = match.text;
            setCurrentCueText(match.text);
          }
        }
      }
    }
  }, [showCaptions, availableSubtitles, syncSubtitles, showToast, activeVttCues]);

  // Double click skip feedback indicator
  const [skipFeedback, setSkipFeedback] = useState<{ side: 'left' | 'right'; text: string; id: number } | null>(null);

  // In-Player Video Ad States (Bypassed for ALL users to guarantee 0-delay instant streaming across all devices)
  const isAdFreeUser = true; // All users (guest, signed-in, premium) receive instant 0s playback
  const adCompletedRef = useRef<boolean>(true);
  const [isPlayingAd, setIsPlayingAd] = useState<boolean>(false);
  const [adDuration, setAdDuration] = useState<number>(0);
  const [adCurrentTime, setAdCurrentTime] = useState<number>(0);
  const [isAdMuted, setIsAdMuted] = useState<boolean>(false);
  const adVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    adCompletedRef.current = true;
    setIsPlayingAd(false);
  }, []);

  const handleAdFinished = useCallback(() => {
    adCompletedRef.current = true;
    if (adVideoRef.current) {
      try {
        adVideoRef.current.pause();
      } catch {}
    }
    setIsPlayingAd(false);

    // Ensure HLS keeps loading chunks
    if (hlsRef.current) {
      try { hlsRef.current.startLoad(-1); } catch {}
    }
    // Ensure DASH is not paused
    if (dashRef.current) {
      try { (dashRef.current as any).play?.(); } catch {}
    }
    // Clear background buffer keeper since playback is resuming
    if (bgBufferIntervalRef.current) {
      clearInterval(bgBufferIntervalRef.current);
      bgBufferIntervalRef.current = null;
    }

    setTimeout(() => {
      if (videoRef.current) {
        const resumePos = playbackPositionRef.current > 0 ? playbackPositionRef.current : initialPosition;
        if (resumePos > 0 && Math.abs(videoRef.current.currentTime - resumePos) > 1.5) {
          videoRef.current.currentTime = resumePos;
        }
        ensureAudioContext();
        if (dashRef.current) {
          try {
            dashRef.current.play();
          } catch {}
        }
        const p = videoRef.current.play();
        if (p !== undefined) {
          p.catch(() => {});
        }
        setIsPlaying(true);
        setIsBuffering(false);
      }
    }, 100);
  }, [initialPosition, ensureAudioContext]);

  // Instant switch for all users without blocking ads
  const triggerAdForSwitch = useCallback(() => {
    // No blocking ad: instant 0ms switch for all users
  }, []);

  // No-op for ad playback
  useEffect(() => {
    setIsPlayingAd(false);
  }, []);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const lastClickRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Comprehensive Quality Change: handles mediaList direct streams, Dash.js ABR & representations, and Hls.js levels
  const handleQualityChange = useCallback(
    (targetQuality: string, specificMedia?: Media, dashIndex?: number) => {
      const currentPos = videoRef.current?.currentTime || playbackPositionRef.current || currentTime || 0;
      const wasPlaying = isPlaying || (!videoRef.current?.paused);
      playbackPositionRef.current = currentPos;
      shouldAutoResumeAfterQualitySwitchRef.current = wasPlaying;

      const lower = targetQuality.toLowerCase();
      const isQualityChanging = lower !== selectedQuality.toLowerCase() || Boolean(specificMedia);

      if (isQualityChanging && !isAdFreeUser) {
        triggerAdForSwitch();
      }

      // 1. If a specific media item is provided or exists in mediaList
      let targetSource: Media | undefined = specificMedia;
      if (!targetSource && mediaList && mediaList.length > 0 && lower !== 'auto') {
        targetSource = mediaList.find((m) => {
          const q = (m.quality || '').toLowerCase();
          const r = (m.resolution || '').toLowerCase();
          if (lower === '4k') return q.includes('4k') || q.includes('2160') || r.includes('2160');
          if (lower === '2160p') return q.includes('2160') || q.includes('4k') || r.includes('2160');
          if (lower === '1080p') return q.includes('1080') || r.includes('1080');
          if (lower === '720p') return q.includes('720') || r.includes('720');
          if (lower === '420p') return q.includes('420') || q.includes('480') || q.includes('360') || r.includes('420') || r.includes('480') || r.includes('360');
          return q === lower;
        });
      }

      if (targetSource) {
        setSelectedQuality(targetQuality);
        const resolved = resolveMediaUrl(targetSource.streamUrl);
        if (resolved && resolved !== streamUrl) {
          setIsBuffering(true);
          setStreamUrl(resolved);
          const tier = QUALITY_TIERS.find((t) => t.value === lower);
          showToast(`Switched quality to ${tier?.label || targetQuality.toUpperCase()}`);
          return;
        }
      } else {
        setSelectedQuality(targetQuality);
      }

      // 2. Dash.js ABR / Representation switching
      if (dashRef.current) {
        try {
          if (lower === 'auto') {
            dashRef.current.updateSettings({
              streaming: {
                abr: {
                  autoSwitchBitrate: { video: true },
                  maxBitrate: { video: -1 },
                },
              },
            });
            setActiveRenderedResolution('');
            showToast('Quality set to Auto (Adaptive Clear Print)');
            return;
          } else {
            dashRef.current.updateSettings({
              streaming: { abr: { autoSwitchBitrate: { video: false } } },
            });
            const player = dashRef.current as any;
            const bitrates = player.getBitrateInfoListFor?.('video') || player.getBitrateInfoList?.('video');
            if (bitrates && bitrates.length > 0) {
              let chosenIdx = 0;
              if (dashIndex !== undefined && bitrates[dashIndex]) {
                chosenIdx = dashIndex;
              } else {
                const targetHeight =
                  lower === '4k' || lower === '2160p'
                    ? 2160
                    : lower === '1080p'
                    ? 1080
                    : lower === '720p'
                    ? 720
                    : 420;
                let closestDiff = Infinity;
                bitrates.forEach((info: any, idx: number) => {
                  const diff = Math.abs((info.height || 0) - targetHeight);
                  if (diff < closestDiff) {
                    closestDiff = diff;
                    chosenIdx = idx;
                  }
                });
              }
              player.setQualityFor?.('video', chosenIdx, true);
              const activeRep = bitrates[chosenIdx];
              const h = activeRep?.height || 0;
              const resLabel =
                lower === '4k'
                  ? '4K Cinema'
                  : h >= 2160
                  ? '2160p Ultra HD'
                  : h >= 1080
                  ? '1080p Full HD'
                  : h >= 720
                  ? '720p HD'
                  : '420p Standard';
              setActiveRenderedResolution(resLabel);
              showToast(
                `Quality switched to ${resLabel} (${
                  activeRep?.bitrate ? `${(activeRep.bitrate / 1000000).toFixed(1)} Mbps` : 'Clear Print'
                })`
              );
              return;
            }
          }
        } catch (err) {
          console.warn('Dash quality switch notice:', err);
        }
      }

      // 3. Hls.js Level switching
      if (hlsRef.current) {
        try {
          if (lower === 'auto') {
            hlsRef.current.currentLevel = -1;
            showToast('Quality set to Auto (Adaptive Clear Print)');
            return;
          } else {
            const levels = hlsRef.current.levels;
            if (levels && levels.length > 0) {
              const targetHeight =
                lower === '4k' || lower === '2160p'
                  ? 2160
                  : lower === '1080p'
                  ? 1080
                  : lower === '720p'
                  ? 720
                  : 420;
              let closestIdx = 0;
              let closestDiff = Infinity;
              levels.forEach((lvl: any, idx: number) => {
                const diff = Math.abs((lvl.height || 0) - targetHeight);
                if (diff < closestDiff) {
                  closestDiff = diff;
                  closestIdx = idx;
                }
              });
              hlsRef.current.currentLevel = closestIdx;
              const lvl = levels[closestIdx];
              const h = lvl?.height || 0;
              const resLabel =
                lower === '4k'
                  ? '4K Cinema'
                  : h >= 2160
                  ? '2160p Ultra HD'
                  : h >= 1080
                  ? '1080p Full HD'
                  : h >= 720
                  ? '720p HD'
                  : '420p Standard';
              setActiveRenderedResolution(resLabel);
              showToast(`Quality switched to ${resLabel}`);
              return;
            }
          }
        } catch (err) {
          console.warn('HLS quality switch notice:', err);
        }
      }

      const tier = QUALITY_TIERS.find((t) => t.value === lower);
      showToast(`Quality set to ${tier?.label || targetQuality}`);
    },
    [mediaList, streamUrl, currentTime, isPlaying, selectedQuality, isAdFreeUser, triggerAdForSwitch, showToast]
  );

  // Audio Language / Dubbing Selector
  const handleSelectAudioLanguage = useCallback(
    (langCode: string, targetSubjectId?: string) => {
      const isAudioChanging = langCode.toLowerCase() !== selectedAudioLang.toLowerCase() || Boolean(targetSubjectId);
      if (isAudioChanging && !isAdFreeUser) {
        triggerAdForSwitch();
      }

      setSelectedAudioLang(langCode);
      const matched = availableAudioOptions.find((l) => l.code === langCode);
      const langLabel = matched ? matched.label : langCode;
      const currentPos = videoRef.current?.currentTime || playbackPositionRef.current || currentTime || 0;
      const wasPlaying = isPlaying;

      // 1. Check if mediaList has a source matching this language or dub
      if (mediaList && mediaList.length > 0) {
        const lowerQuality = selectedQuality.toLowerCase();
        const found =
          mediaList.find((m) => {
            const matchesLang =
              (targetSubjectId && m.dubSubjectId === targetSubjectId) ||
              m.audioLang?.toLowerCase() === langCode.toLowerCase() ||
              (langCode === 'en' && (m.isOriginal || m.audioLang === 'en')) ||
              (matched?.label && m.audioName?.toLowerCase().includes(matched.label.toLowerCase()));
            if (!matchesLang) return false;

            const q = (m.quality || '').toLowerCase();
            if (lowerQuality === '4k' || lowerQuality === '2160p') return q.includes('4k') || q.includes('2160');
            if (lowerQuality === '1080p') return q.includes('1080');
            if (lowerQuality === '720p') return q.includes('720');
            if (lowerQuality === '420p') return q.includes('420') || q.includes('480') || q.includes('360');
            return true;
          }) ||
          mediaList.find((m) =>
            (targetSubjectId && m.dubSubjectId === targetSubjectId) ||
            m.audioLang?.toLowerCase() === langCode.toLowerCase() ||
            (langCode === 'en' && (m.isOriginal || m.audioLang === 'en'))
          );

        if (found) {
          const resolved = resolveMediaUrl(found.streamUrl);
          if (resolved && resolved !== streamUrl) {
            playbackPositionRef.current = currentPos;
            setIsBuffering(true);
            setStreamUrl(resolved);
            setTimeout(() => {
              if (videoRef.current) {
                videoRef.current.currentTime = currentPos;
                if (wasPlaying) videoRef.current.play().catch(() => {});
              }
            }, 200);
            showToast(`Audio: ${langLabel}`);
            return;
          }
        }
      }

      // 2. Dash.js audio track selection
      if (dashRef.current) {
        try {
          const audioTracks = dashRef.current.getTracksFor('audio');
          if (audioTracks && audioTracks.length > 0) {
            const foundTrack = audioTracks.find((t: any) =>
              t.lang?.toLowerCase().startsWith(langCode.toLowerCase()) ||
              t.labels?.some((l: any) => l.text?.toLowerCase().includes(langCode.toLowerCase()))
            );
            if (foundTrack) {
              dashRef.current.setCurrentTrack(foundTrack);
              showToast(`Audio: ${langLabel}`);
              return;
            }
          }
        } catch (err) {
          console.warn('Dash audio switch notice:', err);
        }
      }

      // 3. Hls.js audio track selection
      if (hlsRef.current && hlsRef.current.audioTracks) {
        try {
          const hlsTracks = hlsRef.current.audioTracks;
          const trackIdx = hlsTracks.findIndex((t: any) =>
            t.lang?.toLowerCase().startsWith(langCode.toLowerCase()) ||
            t.name?.toLowerCase().includes(langCode.toLowerCase())
          );
          if (trackIdx !== -1) {
            hlsRef.current.audioTrack = trackIdx;
            showToast(`Audio: ${langLabel}`);
            return;
          }
        } catch (err) {
          console.warn('Hls audio switch notice:', err);
        }
      }

      // 4. HTML5 AudioTracks
      const vid = videoRef.current as any;
      if (vid && vid.audioTracks && vid.audioTracks.length > 1) {
        let switched = false;
        for (let i = 0; i < vid.audioTracks.length; i++) {
          const t = vid.audioTracks[i];
          const match =
            t.language?.toLowerCase().startsWith(langCode.toLowerCase()) ||
            t.label?.toLowerCase().includes(langCode.toLowerCase());
          t.enabled = match;
          if (match) {
            setSelectedAudioTrack(i);
            switched = true;
          }
        }
        if (!switched && vid.audioTracks.length > 0) {
          vid.audioTracks[0].enabled = true;
        }
      }

      showToast(`Audio: ${langLabel}`);
    },
    [availableAudioOptions, mediaList, selectedQuality, selectedAudioLang, streamUrl, isPlaying, currentTime, isAdFreeUser, triggerAdForSwitch, showToast]
  );

  // Subtitle Language Selector
  const handleSelectSubtitle = useCallback(
    (subCode: string) => {
      setSelectedSubtitleLang(subCode);
      if (subCode === 'off') {
        userManuallyToggledCaptionsRef.current = true;
        setShowCaptions(false);
        syncSubtitles('', false);
        currentCueTextRef.current = '';
        setCurrentCueText('');
        showToast('Subtitles turned OFF');
      } else {
        userManuallyToggledCaptionsRef.current = false;
        setShowCaptions(true);
        syncSubtitles(subCode, true);
        const matched = availableSubtitles.find((s) => s.code === subCode);
        showToast(`Subtitles: ${matched?.label || subCode}`);

        // Immediately check current playback position for instantaneous subtitle display
        if (videoRef.current) {
          const cur = videoRef.current.currentTime;
          const cues = activeVttCuesRef.current.length > 0 ? activeVttCuesRef.current : activeVttCues;
          if (cues.length > 0) {
            const match = cues.find((c) => cur >= c.start && cur <= c.end);
            if (match) {
              currentCueTextRef.current = match.text;
              setCurrentCueText(match.text);
            }
          }
        }
      }
    },
    [availableSubtitles, syncSubtitles, showToast, activeVttCues]
  );

  useEffect(() => {
    if (initialPosition > 0 && playbackPositionRef.current === 0) {
      playbackPositionRef.current = initialPosition;
    }
  }, [initialPosition]);

  // Reset initial position applied flag if stream or content changes
  useEffect(() => {
    hasAppliedInitialPosRef.current = false;
  }, [streamUrl, contentId, episodeId]);

  // Immediately save position without throttle (for unmount, page hide, reload, pause)
  const saveCurrentPositionImmediately = useCallback(() => {
    const pos = videoRef.current?.currentTime || playbackPositionRef.current || 0;
    if (pos > 0) {
      const dur = videoRef.current?.duration || duration;

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

  // Save on page reload, tab switch, unmount & RESTORE ON TAB SWITCH RETURN
  useEffect(() => {
    const handleUnload = () => {
      saveCurrentPositionImmediately();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Tab switched away: remember current time and playing state
        if (videoRef.current && videoRef.current.currentTime > 0) {
          playbackPositionRef.current = videoRef.current.currentTime;
        }
        wasPlayingBeforeHiddenRef.current = Boolean(
          videoRef.current && !videoRef.current.paused && !videoRef.current.ended
        );
        saveCurrentPositionImmediately();
      } else if (document.visibilityState === 'visible') {
        // Tab switched back: preserve & restore playback position without restarting!
        const targetPos = playbackPositionRef.current > 0 ? playbackPositionRef.current : initialPosition;
        if (videoRef.current && targetPos > 0) {
          if (videoRef.current.currentTime === 0 || Math.abs(videoRef.current.currentTime - targetPos) > 1.5) {
            videoRef.current.currentTime = targetPos;
            setCurrentTime(targetPos);
          }
          if (wasPlayingBeforeHiddenRef.current) {
            ensureAudioContext();
            videoRef.current.play().catch(() => {});
            setIsPlaying(true);
          }
        }
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
  }, [saveCurrentPositionImmediately, ensureAudioContext, initialPosition]);

  // Apply initial / resume position whenever video is ready or stream loads
  useEffect(() => {
    const targetPos = playbackPositionRef.current > 0 ? playbackPositionRef.current : initialPosition;
    if (
      !hasAppliedInitialPosRef.current &&
      targetPos > 0 &&
      videoRef.current &&
      videoRef.current.readyState >= 1
    ) {
      videoRef.current.currentTime = targetPos;
      setCurrentTime(targetPos);
      hasAppliedInitialPosRef.current = true;
    }
  }, [initialPosition, streamUrl]);

  const isAlreadyBuffered = useCallback((targetTime: number): boolean => {
    if (!videoRef.current || videoRef.current.buffered.length === 0) return false;
    const b = videoRef.current.buffered;
    for (let i = 0; i < b.length; i++) {
      if (targetTime >= b.start(i) - 0.5 && targetTime <= b.end(i) + 0.5) {
        return true;
      }
    }
    return false;
  }, []);

  const updateBuffered = useCallback(() => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const b = videoRef.current.buffered;
      const cur = videoRef.current.currentTime;
      let activeEnd = 0;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= cur + 0.5 && cur <= b.end(i)) {
          activeEnd = b.end(i);
          break;
        }
      }
      if (activeEnd === 0) {
        activeEnd = b.end(b.length - 1);
      }
      setBufferedEnd(activeEnd);
    }
  }, []);

  // Poll buffer levels rapidly (every 500ms) even while paused so progress bar updates in real-time as chunks load
  useEffect(() => {
    const timer = setInterval(() => {
      updateBuffered();
    }, 500);
    return () => clearInterval(timer);
  }, [updateBuffered]);

  // Background byte-range prefetcher for direct MP4 streams:
  // While paused and while playing, continuously fetches forward chunks into browser cache
  useEffect(() => {
    const isDirectMp4 =
      streamUrl &&
      (streamUrl.includes('/proxy') || streamUrl.includes('.mp4')) &&
      !streamUrl.includes('.mpd') &&
      !streamUrl.includes('.m3u8');
    if (!isDirectMp4 || !videoRef.current) return;

    let cancelled = false;
    let prefetchOffset = 0;
    const CHUNK_SIZE = 1.5 * 1024 * 1024; // 1.5 MB chunk

    const prefetchNextChunk = async () => {
      if (cancelled || !videoRef.current) return;
      try {
        const vid = videoRef.current;
        let bufEnd = 0;
        if (vid.buffered && vid.buffered.length > 0) {
          for (let i = 0; i < vid.buffered.length; i++) {
            if (vid.currentTime >= vid.buffered.start(i) && vid.currentTime <= vid.buffered.end(i)) {
              bufEnd = vid.buffered.end(i);
              break;
            }
          }
        }
        const totalDur = vid.duration || duration || 0;
        if (totalDur > 0 && bufEnd >= totalDur - 2) return;

        const estByteRate = 250000; // ~2 Mbps estimate
        const currentTargetPos = bufEnd > 0 ? bufEnd : vid.currentTime;
        const targetByte = Math.floor(currentTargetPos * estByteRate);
        if (prefetchOffset < targetByte) {
          prefetchOffset = targetByte;
        }

        const rangeHeader = `bytes=${prefetchOffset}-${prefetchOffset + CHUNK_SIZE - 1}`;
        prefetchOffset += CHUNK_SIZE;

        await fetch(streamUrl, {
          headers: { Range: rangeHeader },
          cache: 'force-cache',
        }).catch(() => {});
      } catch {}
    };

    const interval = setInterval(prefetchNextChunk, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [streamUrl, duration]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration || duration;
      if (cur > 0) {
        playbackPositionRef.current = cur;
      }
      setCurrentTime(cur);
      if (dur > 0) setDuration(dur);
      updateBuffered();
      saveProgressThrottled(cur, dur);

      // Fast synchronous cue tracking to eliminate latency
      if (showCaptions && selectedSubtitleLang !== 'off') {
        const cues = activeVttCuesRef.current.length > 0 ? activeVttCuesRef.current : activeVttCues;
        if (cues.length > 0) {
          const match = cues.find((c) => cur >= c.start && cur <= c.end);
          const nextText = match ? match.text : '';
          if (nextText !== currentCueTextRef.current) {
            currentCueTextRef.current = nextText;
            setCurrentCueText(nextText);
          }
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      const targetPos = playbackPositionRef.current > 0 ? playbackPositionRef.current : initialPosition;
      if (targetPos > 0) {
        videoRef.current.currentTime = targetPos;
        setCurrentTime(targetPos);
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
    playbackPositionRef.current = newTime;
    setCurrentTime(newTime);
    if (!isAlreadyBuffered(newTime)) {
      setIsBuffering(true);
    }
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickFraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = clickFraction * (duration || 0);
    playbackPositionRef.current = newTime;
    setCurrentTime(newTime);
    if (!isAlreadyBuffered(newTime)) {
      setIsBuffering(true);
    }
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
    if (isPlayingAd) return;
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
    if (isPlayingAd || !touchStartRef.current || !containerRef.current) return;
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

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
    gestureTimeoutRef.current = setTimeout(() => {
      setGestureHUD(null);
    }, 700);

    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (isPlayingAd) return;
    if (!start) return;

    // Check if touch target was a button or interactive element
    if ((e.target as HTMLElement).closest('button, input, a, .no-player-click')) {
      resetControlsTimeout();
      return;
    }

    // If it was a vertical swipe gesture for brightness/volume, don't trigger tap
    if (start.isGesture) {
      return;
    }

    // Single touch tap on mobile
    const touch = e.changedTouches[0];
    const clientX = touch ? touch.clientX : (containerRef.current?.getBoundingClientRect().left || 0);

    // Suppress subsequent synthetic click for 400ms to avoid double toggling
    singleClickTimerRef.current = setTimeout(() => {}, 0);
    handleScreenTap(clientX);
  };

  // Helper to reset the 5-second auto-hide timer on control interaction
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 5000);
  }, [isPlaying]);

  // Screen Tap / Click Handler:
  // If controllers are hidden: show for 5 seconds and auto-hide.
  // If controllers are shown (within those 5 seconds or whenever shown): immediately turn them off ("oof it").
  const lastTapTimeRef = useRef<number>(0);
  const handleScreenTap = useCallback(
    (clientX: number) => {
      const now = Date.now();
      // Deduplicate rapid dual events (e.g. touchEnd + simulated click)
      if (now - lastTapTimeRef.current < 250) {
        return;
      }
      lastTapTimeRef.current = now;

      const rect = containerRef.current?.getBoundingClientRect();
      const clickX = clientX - (rect?.left || 0);
      const width = rect?.width || 1;

      // Double-tap skip within 300ms on outer edges (left 30% or right 30%)
      if (now - lastClickRef.current.time < 300) {
        if (clickX < width * 0.3) {
          // Left side double-click: Rewind 10s
          if (videoRef.current) {
            const target = Math.max(0, videoRef.current.currentTime - 10);
            playbackPositionRef.current = target;
            setCurrentTime(target);
            if (!isAlreadyBuffered(target)) {
              setIsBuffering(true);
            }
            videoRef.current.currentTime = target;
          }
          setSkipFeedback({ side: 'left', text: '10 seconds', id: Date.now() });
          setTimeout(() => setSkipFeedback(null), 800);
          lastClickRef.current = { time: 0, x: 0 };
          resetControlsTimeout();
          return;
        } else if (clickX > width * 0.7) {
          // Right side double-click: Fast-forward 10s
          if (videoRef.current) {
            const target = Math.min(duration, videoRef.current.currentTime + 10);
            playbackPositionRef.current = target;
            setCurrentTime(target);
            if (!isAlreadyBuffered(target)) {
              setIsBuffering(true);
            }
            videoRef.current.currentTime = target;
          }
          setSkipFeedback({ side: 'right', text: '10 seconds', id: Date.now() });
          setTimeout(() => setSkipFeedback(null), 800);
          lastClickRef.current = { time: 0, x: 0 };
          resetControlsTimeout();
          return;
        }
      }

      lastClickRef.current = { time: now, x: clickX };

      // Core toggle:
      // If controls are hidden -> show for 5 seconds and auto-hide
      // If controls are shown -> turn off immediately ("oof it")
      setShowControls((prev) => {
        if (!prev) {
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
          }, 5000);
          return true;
        } else {
          if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
          }
          return false;
        }
      });
    },
    [duration, resetControlsTimeout]
  );

  // Container click handler (desktop mouse or fallback)
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPlayingAd) return;
    if ((e.target as HTMLElement).closest('button, input, a, .no-player-click')) {
      resetControlsTimeout();
      return;
    }

    // Skip click action if touch gesture swipe occurred
    if (touchStartRef.current?.isGesture) {
      touchStartRef.current = null;
      return;
    }

    handleScreenTap(e.clientX);
  };

  // Auto-hide controls on desktop mouse movement (5 seconds)
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 5000);
  };

  // YouTube Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (isPlayingAd) {
        if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
          e.preventDefault();
        }
        return;
      }

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
        toggleCaptions();
      } else if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const step = e.key === 'ArrowLeft' ? 5 : 10;
        if (videoRef.current) {
          const target = Math.max(0, videoRef.current.currentTime - step);
          playbackPositionRef.current = target;
          setCurrentTime(target);
          if (!isAlreadyBuffered(target)) {
            setIsBuffering(true);
          }
          videoRef.current.currentTime = target;
        }
        setSkipFeedback({ side: 'left', text: `-${step}s`, id: Date.now() });
        setTimeout(() => setSkipFeedback(null), 800);
      } else if (e.key === 'l' || e.key === 'L' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.key === 'ArrowRight' ? 5 : 10;
        if (videoRef.current) {
          const target = Math.min(duration, videoRef.current.currentTime + step);
          playbackPositionRef.current = target;
          setCurrentTime(target);
          if (!isAlreadyBuffered(target)) {
            setIsBuffering(true);
          }
          videoRef.current.currentTime = target;
        }
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
  }, [isPlaying, duration, volume, updateVolume, toggleCaptions]);

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
          const nativeHevc = checkNativeHevcSupport();

          const cleanup = await attachHevcSupport(player, {
            forceTranscode: !nativeHevc,
            adaptiveCompute: {
              targetSpeedX: 1.15,
              lowerAfter: 1,
              raiseAfter: 6,
              measureWindow: 2,
            },
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

        player.updateSettings({
          streaming: {
            scheduling: {
              scheduleWhilePaused: true,
              defaultTimeout: 30, // Rapid chunk scheduling cycle (every 30ms) to load segments without hesitation
            },
            buffer: {
              initialBufferLevel: streamingProfile.dashInitialBufferLevel, // 0.3s Instant startup threshold
              bufferTimeDefault: streamingProfile.dashBufferTimeDefault,
              bufferTimeAtTopQuality: streamingProfile.dashBufferTimeAtTopQuality,
              bufferTimeAtTopQualityLongForm: streamingProfile.dashBufferTimeAtTopQualityLongForm,
              bufferToKeep: streamingProfile.dashBufferToKeep,
              bufferPruningInterval: streamingProfile.dashBufferPruningInterval,
              avoidCurrentTimeRangePruning: true,
              enableSeekDecorrelationFix: true,
              fastSwitchEnabled: true,
              reuseExistingSourceBuffers: true,
            },
            gaps: {
              jumpGaps: true,
              jumpLargeGaps: true,
              smallGapLimit: 1.5,
            },
            abr: {
              autoSwitchBitrate: {
                video: true,
                audio: true,
              },
              initialBitrate: {
                video: streamingProfile.dashInitialBitrate,
              },
            },
            retryIntervals: {
              MPD: 150,
              InitializationSegment: 150,
              MediaSegment: 250,
            },
            retryAttempts: {
              MPD: 8,
              InitializationSegment: 8,
              MediaSegment: 8,
            },
          },
        });

        player.initialize(videoRef.current, effectiveUrl, true);
        dashRef.current = player;
        try {
          player.preload();
        } catch {}

        player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
          setIsBuffering(false);
          const targetPos = playbackPositionRef.current > 0 ? playbackPositionRef.current : initialPosition;
          if (videoRef.current && targetPos > 0) {
            videoRef.current.currentTime = targetPos;
            hasAppliedInitialPosRef.current = true;
          }
          try {
            const bitrates = (player as any).getBitrateInfoListFor?.('video') || (player as any).getBitrateInfoList?.('video');
            if (bitrates && bitrates.length > 0) {
              setDashQualities(
                bitrates.map((b: any, idx: number) => {
                  const h = b.height || 0;
                  const label =
                    h >= 2160
                      ? '4K (2160p)'
                      : h >= 1080
                      ? '1080p'
                      : h >= 720
                      ? '720p'
                      : h >= 480
                      ? '480p'
                      : `${h || 360}p`;
                  const badge =
                    h >= 2160 ? 'Ultra HD' : h >= 1080 ? 'Full HD' : h >= 720 ? 'HD' : 'Standard';
                  const mbps = b.bitrate ? ` • ${(b.bitrate / 1000000).toFixed(1)} Mbps` : '';
                  return {
                    index: idx,
                    qualityIndex: b.qualityIndex !== undefined ? b.qualityIndex : idx,
                    height: h,
                    width: b.width || 0,
                    bitrate: b.bitrate || 0,
                    label: `${label}${mbps}`,
                    badge,
                    value: label.toLowerCase(),
                  };
                })
              );
            }
          } catch {}
          try {
            const dashAudio = player.getTracksFor('audio');
            if (dashAudio && dashAudio.length > 0) {
              const tracks = dashAudio.map((t: any, idx: number) => ({
                index: idx,
                label: t.labels?.[0]?.text || t.lang || `Audio Track ${idx + 1}`,
                language: t.lang || '',
              }));
              setAudioTracksList(tracks);
            }
          } catch {}
        });

        player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e: any) => {
          if (e.mediaType === 'video') {
            const bitrates = (player as any).getBitrateInfoListFor?.('video') || (player as any).getBitrateInfoList?.('video');
            if (bitrates && bitrates[e.newQuality]) {
              const activeRep = bitrates[e.newQuality];
              const h = activeRep.height || 0;
              const resLabel = h >= 2160 ? '4K' : h >= 1080 ? '1080p' : h >= 720 ? '720p' : `${h}p`;
              setActiveRenderedResolution(resLabel);
            }
          }
        });

        player.on(dashjs.MediaPlayer.events.CAN_PLAY, () => {
          setIsBuffering(false);
          updateBuffered();
        });

        player.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, () => {
          updateBuffered();
        });

        player.on(dashjs.MediaPlayer.events.ERROR, (e: any) => {
          console.warn('DASH Player Error event:', e);
        });
      };

      initDash();
    } else if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: streamingProfile.hlsLowLatencyMode,
        backBufferLength: streamingProfile.hlsBackBufferLength,
        maxBufferLength: streamingProfile.hlsMaxBufferLength,
        maxMaxBufferLength: streamingProfile.hlsMaxMaxBufferLength,
        maxBufferSize: streamingProfile.hlsMaxBufferSize,
        maxFragLookUpTolerance: streamingProfile.hlsMaxFragLookUpTolerance,
        startLevel: streamingProfile.hlsStartLevel,
        autoStartLoad: true,
        // startFragPrefetch: true aggressively prefetches the next segment in advance
        startFragPrefetch: true,
        // Progressive loading: chunks are demuxed & appended progressively without waiting for full download
        progressive: true,
        // Rapid fragment loading & fault-tolerant retries to eliminate stutter
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 250,
        fragLoadingMaxRetryTimeout: 3000,
        levelLoadingTimeOut: 10000,
        manifestLoadingTimeOut: 10000,
        abrBandWidthFactor: 0.9,
        abrEwmaDefaultEstimate: 2500000,
        maxLoadingDelay: 1,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 1,
        preferManagedMediaSource: false,
      });

      hls.loadSource(effectiveUrl);
      hls.attachMedia(videoRef.current);

      // Start loading from the current resume position (or beginning) immediately
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        const startPos = playbackPositionRef.current > 0 ? playbackPositionRef.current : (initialPosition > 0 ? initialPosition : -1);
        hls.startLoad(startPos);
      });

      // ---- Rapid Background buffer keeper (500ms heartbeat) ----
      // Keeps HLS and DASH actively loading all possible chunks ahead even while paused,
      // and keeps loading further chunks continuously while playing.
      if (bgBufferIntervalRef.current) clearInterval(bgBufferIntervalRef.current);
      bgBufferIntervalRef.current = setInterval(() => {
        const vid = videoRef.current;
        const isPaused = !vid || vid.paused || vid.ended;

        if (hlsRef.current) {
          try {
            if (isPaused) {
              const mediaDur = vid?.duration || duration || 3600;
              const targetHorizon = Math.max(3600, mediaDur);
              hlsRef.current.config.maxBufferLength = targetHorizon;
              hlsRef.current.config.maxMaxBufferLength = targetHorizon * 2;
            }
            hlsRef.current.startLoad(-1);
          } catch {}
        }

        if (dashRef.current) {
          try {
            (dashRef.current as any).preload?.();
          } catch {}
        }

        updateBuffered();
      }, 500);

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        updateBuffered();
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        const targetPos = playbackPositionRef.current > 0 ? playbackPositionRef.current : initialPosition;
        if (videoRef.current && targetPos > 0) {
          videoRef.current.currentTime = targetPos;
          hasAppliedInitialPosRef.current = true;
        }
        if (hls.levels && hls.levels.length > 0) {
          setHlsQualities(
            hls.levels.map((lvl: any, idx: number) => {
              const h = lvl.height || 0;
              const label =
                h >= 2160 ? '4K (2160p)' : h >= 1080 ? '1080p' : h >= 720 ? '720p' : `${h || 480}p`;
              const badge =
                h >= 2160 ? 'Ultra HD' : h >= 1080 ? 'Full HD' : h >= 720 ? 'HD' : 'Standard';
              return {
                index: idx,
                height: h,
                width: lvl.width || 0,
                bitrate: lvl.bitrate || 0,
                label: `${label} HD`,
                badge,
                value: label.toLowerCase(),
              };
            })
          );
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
      if (videoRef.current.src !== effectiveUrl) {
        videoRef.current.src = effectiveUrl;
        videoRef.current.load();
      }
    } else {
      // Direct MP4 or proxy stream
      if (videoRef.current.src !== effectiveUrl) {
        videoRef.current.src = effectiveUrl;
        videoRef.current.load();
      }
    }

    return () => {
      isCancelled = true;
      // Stop background buffer keeper
      if (bgBufferIntervalRef.current) {
        clearInterval(bgBufferIntervalRef.current);
        bgBufferIntervalRef.current = null;
      }
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
  }, [streamUrl, isTranscodeMode]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={handleContainerClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full aspect-video bg-black rounded-xl sm:rounded-2xl overflow-hidden group shadow-2xl select-none touch-manipulation"
    >
      <video
        ref={videoRef}
        preload="auto"
        playsInline
        onProgress={updateBuffered}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadStart={() => setIsBuffering(true)}
        onWaiting={handleStall}
        onStalled={handleStall}
        onSeeking={() => {
          if (videoRef.current && !isAlreadyBuffered(videoRef.current.currentTime)) {
            setIsBuffering(true);
          }
        }}
        onSeeked={() => {
          setIsBuffering(false);
          updateBuffered();
        }}
        onCanPlay={() => {
          setIsBuffering(false);
          autoRetryAttemptsRef.current = 0;
          setStreamError(null);
          if (playbackPositionRef.current > 0 && videoRef.current) {
            const diff = Math.abs(videoRef.current.currentTime - playbackPositionRef.current);
            if (diff > 1) {
              videoRef.current.currentTime = playbackPositionRef.current;
            }
          }
          if (shouldAutoResumeAfterQualitySwitchRef.current && videoRef.current) {
            videoRef.current.play().catch(() => {});
            shouldAutoResumeAfterQualitySwitchRef.current = false;
          }
        }}
        onPlay={() => {
          autoRetryAttemptsRef.current = 0;
          setStreamError(null);
          setIsPlaying(true);
          setIsBuffering(false);
          ensureAudioContext();

          // While playing, maintain deep forward buffer horizon and keep loading chunks continuously
          if (dashRef.current) {
            try {
              dashRef.current.updateSettings({
                streaming: {
                  scheduling: {
                    scheduleWhilePaused: true,
                    defaultTimeout: 35,
                  },
                  buffer: {
                    bufferTimeDefault: streamingProfile.dashBufferTimeDefault,
                    bufferTimeAtTopQuality: streamingProfile.dashBufferTimeAtTopQuality,
                    bufferTimeAtTopQualityLongForm: streamingProfile.dashBufferTimeAtTopQualityLongForm,
                  },
                },
              });
              (dashRef.current as any).preload?.();
            } catch {}
          }

          if (hlsRef.current) {
            try {
              hlsRef.current.config.maxBufferLength = streamingProfile.hlsMaxBufferLength;
              hlsRef.current.config.maxMaxBufferLength = streamingProfile.hlsMaxMaxBufferLength;
              hlsRef.current.startLoad(-1);
            } catch {}
          }

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
        onPause={() => {
          setIsPlaying(false);
          // 1. DASH: While paused, expand buffer horizon to entire video duration and load all possible chunks
          if (dashRef.current) {
            try {
              const mediaDur = videoRef.current?.duration || duration || 3600;
              const targetHorizon = Math.max(3600, mediaDur);
              dashRef.current.updateSettings({
                streaming: {
                  scheduling: {
                    scheduleWhilePaused: true,
                    defaultTimeout: 25, // Rapid 25ms scheduler to pump chunks non-stop
                  },
                  buffer: {
                    bufferTimeDefault: targetHorizon,
                    bufferTimeAtTopQuality: targetHorizon,
                    bufferTimeAtTopQualityLongForm: targetHorizon,
                    avoidCurrentTimeRangePruning: true,
                  },
                },
              });
              (dashRef.current as any).preload?.();
            } catch {}
          }

          // 2. HLS: While paused, expand buffer horizon and load all possible chunks of the stream
          if (hlsRef.current) {
            try {
              const mediaDur = videoRef.current?.duration || duration || 3600;
              const targetHorizon = Math.max(3600, mediaDur);
              hlsRef.current.config.maxBufferLength = targetHorizon;
              hlsRef.current.config.maxMaxBufferLength = targetHorizon * 2;
              hlsRef.current.startLoad(-1);
            } catch {}
          }
        }}
        crossOrigin="anonymous"
        onError={(e) => {
          const vid = e.currentTarget;
          const currentSrc = vid.src || '';

          // If no stream URL or src is empty or not attached yet, ignore false alarm
          if (!streamUrl || !currentSrc || currentSrc === window.location.href) {
            return;
          }

          // If DASH player is managing the stream, let DASH handle its own errors
          const isDashStream =
            streamUrl.includes('.mpd') ||
            streamUrl.includes('/dash/') ||
            activeMedia?.mimeType === 'application/dash+xml' ||
            activeMedia?.format === 'DASH';

          if (isDashStream && dashRef.current) {
            return;
          }

          // Silent transparent auto-retry on initial load before ever showing an error popup
          if (autoRetryAttemptsRef.current < 2 && !isRetryingRef.current) {
            autoRetryAttemptsRef.current += 1;
            isRetryingRef.current = true;
            setIsBuffering(true);
            setTimeout(() => {
              isRetryingRef.current = false;
              const effectiveUrl = getEffectiveStreamUrl(streamUrl, isTranscodeMode);
              if (hlsRef.current) {
                hlsRef.current.loadSource(effectiveUrl);
                hlsRef.current.startLoad();
              } else if (videoRef.current) {
                videoRef.current.src = effectiveUrl;
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
              }
            }, 800);
            return;
          }

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
      >
        {effectiveSubtitles &&
          effectiveSubtitles.map((sub, idx) => {
            let trackSrc = resolveMediaUrl(sub.src);
            if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
              if (trackSrc.includes('/api/streaming/')) {
                trackSrc = trackSrc.substring(trackSrc.indexOf('/api/streaming/'));
              }
            }
            return (
              <track
                key={sub.id || `${sub.language}-${idx}`}
                kind="subtitles"
                label={sub.label}
                srcLang={sub.language}
                src={trackSrc}
                default={sub.default}
              />
            );
          })}
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

      {/* Floating HUD Toast Notification (Quality, Audio Language, Subtitles) */}
      {toastMessage && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-fade-in">
          <div className="bg-[#121212]/95 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full shadow-2xl flex items-center space-x-2 text-xs font-semibold text-white tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#FF0000] animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* On-screen Cinematic Subtitle Display */}
      {showCaptions && selectedSubtitleLang !== 'off' && currentCueText && (
        <div
          className={`absolute left-0 right-0 pointer-events-none flex justify-center items-end px-4 sm:px-8 z-40 transition-all duration-200 ${
            showControls ? 'bottom-20 sm:bottom-24 md:bottom-28' : 'bottom-6 sm:bottom-10'
          }`}
        >
          <div
            style={{
              textShadow:
                '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, -2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000, 0 2px 5px rgba(0,0,0,0.95), 0 4px 12px rgba(0,0,0,0.85)',
              fontSize: getResponsiveSubtitleFontSize(subtitleSize),
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            }}
            className="bg-transparent text-white font-semibold max-w-4xl text-center leading-relaxed select-none whitespace-pre-line tracking-wide drop-shadow-md"
          >
            {currentCueText}
          </div>
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
          <p className="text-[10px] sm:text-[11px] text-[#FF0000] font-semibold uppercase tracking-wider">
            {selectedQuality} • {activeRenderedResolution || activeMedia?.resolution || 'HD'} Clear Print
          </p>
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
              onClick={toggleCaptions}
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

          <div className="absolute left-2 right-2 bottom-14 sm:left-auto sm:right-4 sm:w-72 max-w-[calc(100%-16px)] bg-[#181818]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl p-2 z-50 text-xs sm:text-[13px] text-white font-sans no-player-click animate-fade-in overflow-hidden">
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
                    <span>
                      {QUALITY_TIERS.find((t) => t.value === selectedQuality.toLowerCase())?.label ||
                        (activeRenderedResolution ? `${activeRenderedResolution} HD` : selectedQuality)}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Language & Dubbing Item */}
                <button
                  onClick={() => setSettingsTab('language')}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center space-x-2.5">
                    <Languages className="w-4 h-4 text-white/80" />
                    <span className="text-white/90 font-medium">Audio & Subtitles</span>
                  </div>
                  <div className="flex items-center space-x-1 text-white/60 text-[11px]">
                    <span className="truncate max-w-[80px]">
                      {availableAudioOptions.find((a) => a.code === selectedAudioLang)?.label.split(' ')[0] || 'English'}
                    </span>
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
                    <span className="text-white/90 font-medium">Audio Boost & Fix</span>
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
                  <span>Quality & Resolution</span>
                </button>
                <div className="py-1 max-h-80 overflow-y-auto space-y-1 pr-1 scrollbar-none">
                  {/* Primary Quality Hierarchy: Auto, 420p, 720p, 1080p, 2160p, 4k */}
                  <div className="px-3 py-1 text-[11px] font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between">
                    <span>Resolution & Print</span>
                    <span className="text-brand-400 text-[10px] font-medium">Fast Rendering</span>
                  </div>

                  <div className="space-y-0.5">
                    {QUALITY_TIERS.map((tier) => {
                      const currentLower = selectedQuality.toLowerCase();
                      const renderLower = (activeRenderedResolution || '').toLowerCase();
                      const isSelected =
                        tier.value === 'auto'
                          ? currentLower === 'auto'
                          : tier.value === '4k'
                          ? currentLower === '4k' || (currentLower.includes('4k') && !currentLower.includes('2160')) || renderLower.includes('4k')
                          : tier.value === '2160p'
                          ? currentLower === '2160p' || (currentLower.includes('2160') && currentLower !== '4k') || renderLower.includes('2160')
                          : tier.value === '1080p'
                          ? currentLower === '1080p' || currentLower.includes('1080') || renderLower.includes('1080')
                          : tier.value === '720p'
                          ? currentLower === '720p' || currentLower.includes('720') || renderLower.includes('720')
                          : tier.value === '420p'
                          ? currentLower === '420p' ||
                            currentLower.includes('420') ||
                            currentLower.includes('480') ||
                            currentLower.includes('360') ||
                            renderLower.includes('420') ||
                            renderLower.includes('480') ||
                            renderLower.includes('360')
                          : currentLower === tier.value.toLowerCase();

                      const isUltra = tier.height >= 2160 || tier.value === '4k' || tier.value === '2160p';
                      const isFullHd = tier.height === 1080 || tier.value === '1080p';
                      const isHd = tier.height === 720 || tier.value === '720p';
                      const isFast = tier.value === '420p';
                      const isAuto = tier.value === 'auto';

                      return (
                        <button
                          key={tier.value}
                          onClick={() => {
                            handleQualityChange(tier.value);
                            setShowSettings(false);
                            setSettingsTab('main');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left ${
                            isSelected
                              ? 'bg-white/15 text-white font-medium ring-1 ring-white/20'
                              : 'hover:bg-white/5 text-white/80'
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-2">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-semibold text-xs sm:text-[13px]">{tier.label}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                  isUltra
                                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                                    : isFullHd
                                    ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40'
                                    : isHd
                                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                                    : isFast
                                    ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                                    : 'bg-green-500/25 text-green-300 border border-green-500/40'
                                }`}
                              >
                                {tier.badge}
                              </span>
                            </div>
                            <span className="text-[10px] text-white/50 truncate">
                              {tier.description}
                            </span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#FF0000] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Specific Provider Sources if multiple prints exist */}
                  {mediaList && mediaList.length > 1 && (
                    <div className="pt-2 mt-2 border-t border-white/10">
                      <div className="px-3 py-1 text-[11px] font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between">
                        <span>Alternate Provider Streams</span>
                        <span className="text-white/40 text-[10px]">{mediaList.length} Streams</span>
                      </div>
                      <div className="space-y-0.5 mt-0.5">
                        {mediaList.map((m, idx) => {
                          const isSourceSelected = streamUrl === resolveMediaUrl(m.streamUrl);
                          return (
                            <button
                              key={m._id || `src-${idx}`}
                              onClick={() => {
                                handleQualityChange(m.quality, m);
                                setShowSettings(false);
                                setSettingsTab('main');
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors text-left ${
                                isSourceSelected ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 text-white/70'
                              }`}
                            >
                              <div className="flex flex-col min-w-0 pr-2">
                                <span className="truncate text-xs">{m.quality} • {m.format || 'Stream'}</span>
                                {m.fileSize && (
                                  <span className="text-[10px] text-white/40">{m.fileSize}</span>
                                )}
                              </div>
                              {isSourceSelected && <Check className="w-3.5 h-3.5 text-[#FF0000] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {settingsTab === 'language' && (
              <div>
                <button
                  onClick={() => setSettingsTab('main')}
                  className="w-full flex items-center space-x-2 px-3 py-2 border-b border-white/10 text-white/80 hover:text-white transition-colors text-left font-semibold"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Audio & Subtitles</span>
                </button>
                <div className="py-1 max-h-64 overflow-y-auto space-y-2 pr-1">
                  {/* Audio Languages Section */}
                  <div>
                    <div className="px-3 py-1 text-[11px] font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between">
                      <span>Audio Track / Dubbing</span>
                      <span className="text-white/40 text-[10px]">Instant</span>
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {availableAudioOptions.map((lang) => {
                        const isSelected = selectedAudioLang === lang.code;
                        return (
                          <button
                            key={lang.code}
                            onClick={() => {
                              handleSelectAudioLanguage(lang.code, lang.subjectId);
                              setShowSettings(false);
                              setSettingsTab('main');
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors text-left text-xs ${
                              isSelected ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 text-white/80'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span>{lang.label}</span>
                              <span className="text-[10px] text-white/50">{lang.detail}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#FF0000]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subtitle Languages Section */}
                  <div className="pt-1 border-t border-white/10">
                    <div className="px-3 py-1 text-[11px] font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between">
                      <span>Subtitles / Captions (CC)</span>
                      <span className="text-white/40 text-[10px]">{showCaptions ? 'Active' : 'Off'}</span>
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {availableSubtitles.map((sub) => {
                        const isSelected = showCaptions ? selectedSubtitleLang === sub.code : sub.code === 'off';
                        return (
                          <button
                            key={sub.code}
                            onClick={() => {
                              handleSelectSubtitle(sub.code);
                              setShowSettings(false);
                              setSettingsTab('main');
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors text-left text-xs ${
                              isSelected ? 'bg-white/10 text-white font-medium' : 'hover:bg-white/5 text-white/80'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span>{sub.label}</span>
                              {sub.detail && <span className="text-[10px] text-white/50">{sub.detail}</span>}
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#FF0000]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subtitle Size Configuration Section */}
                  {showCaptions && selectedSubtitleLang !== 'off' && (
                    <div className="pt-2 mt-2 border-t border-white/10">
                      <div className="px-3 py-1 text-[11px] font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between">
                        <span>Subtitle Size (Screen Match)</span>
                        <span className="text-brand-400 text-[10px] capitalize font-medium">{subtitleSize}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 px-2 mt-1">
                        {[
                          { id: 'small', label: 'Small' },
                          { id: 'medium', label: 'Normal' },
                          { id: 'large', label: 'Large' },
                          { id: 'extralarge', label: 'XL' },
                        ].map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSubtitleSize(s.id as any);
                              try {
                                localStorage.setItem('moviebuzz_sub_size', s.id);
                              } catch {}
                              showToast(`Subtitle size: ${s.label}`);
                            }}
                            className={`py-1 rounded text-xs text-center font-medium transition-colors ${
                              subtitleSize === s.id
                                ? 'bg-brand-600 text-white shadow font-bold'
                                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
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



      {/* In-Player Pre-Roll Video Ad - Mandatory for free users, 0 ads for Premium/Admin */}
      {isPlayingAd && !isAdFreeUser && (
        <div className="absolute inset-0 z-50 bg-black flex items-center justify-center select-none no-player-click">
          <video
            ref={adVideoRef}
            src="https://res.cloudinary.com/urzka7oz/video/upload/v1791782822/gemini_generated_video_0ef26b51.mp4"
            autoPlay
            playsInline
            preload="auto"
            muted={isAdMuted}
            poster="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1280&q=80"
            onError={() => {
              handleAdFinished();
            }}
            onCanPlay={() => {
              if (adVideoRef.current && isPlayingAd) {
                const p = adVideoRef.current.play();
                if (p !== undefined) p.catch(() => {});
              }
            }}
            onTimeUpdate={(e) => {
              const vid = e.currentTarget;
              setAdCurrentTime(vid.currentTime);
              if (vid.duration && !isNaN(vid.duration)) setAdDuration(vid.duration);
            }}
            onEnded={handleAdFinished}
            className="w-full h-full object-contain cursor-pointer"
            onClick={() => setIsAdMuted((prev) => !prev)}
          />

          {/* Prominent Tap to Unmute Overlay */}
          {isAdMuted && (
            <button
              onClick={() => {
                setIsAdMuted(false);
                if (adVideoRef.current) adVideoRef.current.muted = false;
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-black/85 hover:bg-black/95 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-full border border-white/20 shadow-2xl flex items-center gap-2 backdrop-blur-md animate-pulse pointer-events-auto cursor-pointer"
            >
              <VolumeX className="w-4 h-4 text-amber-400" />
              <span>Tap for Sound 🔊</span>
            </button>
          )}

          {/* Top Left: Ad Badge & Sponsor Countdown */}
          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-50 flex items-center gap-2 pointer-events-auto">
            <div className="bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white/90 border border-white/15 flex items-center gap-2 shadow-xl">
              <span className="bg-[#FFCC00] text-black font-extrabold text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide">
                SPONSORED AD
              </span>
              <span className="text-white/60">·</span>
              <span className="text-amber-300 font-medium">
                {adDuration > 0
                  ? `${Math.max(0, Math.ceil(adDuration - adCurrentTime))}s remaining`
                  : 'Playing ad...'}
              </span>
            </div>
          </div>

          {/* Top Right: Sound Mute/Unmute Toggle */}
          <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-50 pointer-events-auto">
            <button
              onClick={() => setIsAdMuted((prev) => !prev)}
              className="bg-black/85 hover:bg-black/95 backdrop-blur-md px-3 py-1.5 rounded-lg text-white border border-white/15 shadow-xl flex items-center gap-1.5 text-xs transition-colors"
            >
              {isAdMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              <span className="text-[11px] font-semibold">{isAdMuted ? 'Unmute' : 'Mute'}</span>
            </button>
          </div>

          {/* Bottom Notice: Full Ad Must Play */}
          <div className="absolute bottom-5 right-3 sm:right-6 z-50 pointer-events-auto">
            <div className="bg-black/85 backdrop-blur-md text-white/90 text-xs font-semibold px-3.5 py-2 rounded-xl border border-white/15 shadow-2xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FFCC00] animate-pulse" />
              <span>Movie will play after this ad</span>
            </div>
          </div>

          {/* Yellow Ad Progress Track at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20 z-50">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-[#FFCC00] transition-all duration-150"
              style={{
                width: `${adDuration > 0 ? (adCurrentTime / adDuration) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
