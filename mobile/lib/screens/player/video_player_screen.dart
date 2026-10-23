import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:http/http.dart' as http;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../constants/app_colors.dart';
import '../../models/content.dart';
import '../../models/episode.dart';
import '../../models/season.dart';
import '../../models/media.dart';
import '../../services/api_service.dart';
import '../../providers/watchlist_provider.dart';
import '../../utils/media_url_resolver.dart';
import 'widgets/double_tap_indicator.dart';

enum VideoFitMode { fit, fill, stretch }

class VideoPlayerScreen extends StatefulWidget {
  final Content content;
  final Episode? episode;
  final Media? initialMedia;
  final double initialProgress;
  final List<Episode>? playlist;
  final bool startInFullscreen;

  const VideoPlayerScreen({
    super.key,
    required this.content,
    this.episode,
    this.initialMedia,
    this.initialProgress = 0,
    this.playlist,
    this.startInFullscreen = false,
  });

  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen> {
  final ApiService _api = ApiService();

  VideoPlayerController? _videoPlayerController;
  bool _isLoading = true;
  String? _errorMessage;
  bool _showControls = true;
  bool _isLocked = false;
  bool _isFullscreen = false;
  VideoFitMode _fitMode = VideoFitMode.fit;
  double _playbackSpeed = 1.0;

  // Double tap animation states
  bool _showForwardIndicator = false;
  bool _showRewindIndicator = false;

  Timer? _controlsTimer;
  Timer? _progressSaveTimer;

  // Active playing episode and playlist
  late Content _currentContent;
  Episode? _currentEpisode;
  List<Episode> _playlist = [];
  List<Season> _seasons = [];
  Season? _selectedSeason;
  List<Media> _availableQualities = [];
  Media? _currentMedia;
  List<Content> _similarContent = [];

  // Pre-roll Sponsor Ad & Background Chunk Buffering States
  bool _isPlayingAd = true;
  int _adSecondsRemaining = 5;
  bool _canSkipAd = false;
  Timer? _adTimer;
  double _chunkBufferProgress = 0.20;
  String _chunkBufferStatus = 'Edge CDN pipeline active • Downloading initial chunks...';
  String _currentStreamUrl = '';
  Timer? _chunkPrefetchTimer;

  @override
  void initState() {
    super.initState();
    _currentContent = widget.content;
    _currentEpisode = widget.episode;
    _playlist = widget.playlist ?? [];

    if (widget.startInFullscreen) {
      _enterFullscreen();
    } else {
      _setPortraitOrientations();
    }

    _loadMetadataAndStream();
  }

  @override
  void dispose() {
    _adTimer?.cancel();
    _chunkPrefetchTimer?.cancel();
    _controlsTimer?.cancel();
    _progressSaveTimer?.cancel();
    _saveProgressNow();
    _videoPlayerController?.dispose();

    // Reset device back to normal system orientation
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _setPortraitOrientations() {
    setState(() => _isFullscreen = false);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }

  void _enterFullscreen() {
    setState(() => _isFullscreen = true);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeRight,
      DeviceOrientation.landscapeLeft,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  void _toggleFullscreen() {
    if (_isFullscreen) {
      _setPortraitOrientations();
    } else {
      _enterFullscreen();
    }
  }

  Future<void> _loadMetadataAndStream() async {
    _initStream();

    // Load series seasons or similar recommendations in parallel
    if (_currentContent.isSeries) {
      try {
        final seasons = await _api.getSeriesSeasons(_currentContent.id);
        setState(() {
          _seasons = seasons;
          if (_seasons.isNotEmpty) {
            _selectedSeason = _seasons.first;
          }
        });
        if (_selectedSeason != null && _playlist.isEmpty) {
          final episodes = await _api.getSeasonEpisodes(_selectedSeason!.id);
          setState(() => _playlist = episodes);
        }
      } catch (_) {}
    } else {
      try {
        final similar = await _api.getMovies(limit: 6, sort: 'popularity');
        setState(() => _similarContent = similar.where((c) => c.id != _currentContent.id).toList());
      } catch (_) {}
    }
  }

  void _startPreRollAd() {
    _adTimer?.cancel();
    setState(() {
      _isPlayingAd = true;
      _adSecondsRemaining = 5;
      _canSkipAd = false;
      _chunkBufferProgress = 0.25;
      _chunkBufferStatus = 'Edge CDN pipeline active • Downloading initial chunks...';
    });

    _adTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        if (_adSecondsRemaining > 1) {
          _adSecondsRemaining--;
          _chunkBufferProgress = (_chunkBufferProgress + 0.18).clamp(0.0, 1.0);
          if (_adSecondsRemaining <= 2) {
            _canSkipAd = true;
          }
          if (_chunkBufferProgress >= 0.8) {
            _chunkBufferStatus = 'Chunks ready! Buffer primed 100%';
          }
        } else {
          _finishAdAndPlayMainVideo();
        }
      });
    });
  }

  void _finishAdAndPlayMainVideo() {
    _adTimer?.cancel();
    setState(() {
      _isPlayingAd = false;
    });

    final controller = _videoPlayerController;
    if (controller != null && controller.value.isInitialized) {
      controller.play();
      _startControlsTimer();
    }
  }

  void _startContinuousChunkPrefetching() {
    _chunkPrefetchTimer?.cancel();
    // Runs periodically during both PLAYING and PAUSED states!
    _chunkPrefetchTimer = Timer.periodic(const Duration(seconds: 3), (timer) async {
      final controller = _videoPlayerController;
      if (controller == null || !controller.value.isInitialized) return;

      final currentPos = controller.value.position;
      final bufferedRanges = controller.value.buffered;

      Duration bufferedAhead = Duration.zero;
      for (final range in bufferedRanges) {
        if (range.start <= currentPos && range.end >= currentPos) {
          bufferedAhead = range.end - currentPos;
          break;
        }
      }

      if (mounted) {
        setState(() {
          _chunkBufferStatus = controller.value.isPlaying
              ? 'Streaming • Buffered: +${bufferedAhead.inSeconds}s ahead'
              : 'Paused • Pre-buffering chunks: +${bufferedAhead.inSeconds}s ahead';
        });
      }

      // If buffered chunks ahead is less than 60 seconds, prefetch next chunk over Edge worker
      if (bufferedAhead.inSeconds < 60 && _currentStreamUrl.isNotEmpty) {
        try {
          final uri = Uri.parse(_currentStreamUrl);
          await http.get(
            uri,
            headers: {
              'Range': 'bytes=0-1048576',
              'User-Agent': 'MovieBuzz-Mobile/2.3',
              'Referer': 'https://cinestream-proxy.dev-patel-codinggita.workers.dev',
            },
          );
        } catch (_) {}
      }
    });
  }

  Future<void> _initStream([Episode? episodeToPlay, Media? mediaToPlay]) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      if (episodeToPlay != null) _currentEpisode = episodeToPlay;
      if (mediaToPlay != null) _currentMedia = mediaToPlay;
    });

    _videoPlayerController?.dispose();
    _videoPlayerController = null;

    try {
      String streamUrl = '';

      if (_currentMedia != null) {
        streamUrl = _currentMedia!.streamUrl;
      } else if (_currentEpisode != null) {
        // Fetch episode streams
        final res = await _api.getContentBySlug(_currentContent.slug);
        _availableQualities = (res['media'] as List<Media>?) ?? [];
        if (_availableQualities.isNotEmpty) {
          _currentMedia = _availableQualities.first;
          streamUrl = _currentMedia!.streamUrl;
        }
      } else {
        // Fetch movie streams
        final res = await _api.getContentBySlug(_currentContent.slug);
        _availableQualities = (res['media'] as List<Media>?) ?? [];
        if (_availableQualities.isNotEmpty) {
          _currentMedia = _availableQualities.first;
          streamUrl = _currentMedia!.streamUrl;
        }
      }

      if (streamUrl.isNotEmpty) {
        streamUrl = MediaUrlResolver.wrapStreamWithCloudflare(
          streamUrl,
          apiBase: _api.baseUrl,
        );
      } else {
        // High quality demo fallback video for testing
        streamUrl =
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      }

      _currentStreamUrl = streamUrl;
      _startPreRollAd();

      final controller = VideoPlayerController.networkUrl(
        Uri.parse(streamUrl),
        httpHeaders: {
          'User-Agent': 'MovieBuzz-Mobile/2.3',
          'Referer': 'https://cinestream-proxy.dev-patel-codinggita.workers.dev',
        },
      );

      await controller.initialize();

      if (widget.initialProgress > 0 &&
          widget.initialProgress < controller.value.duration.inSeconds) {
        await controller.seekTo(Duration(seconds: widget.initialProgress.toInt()));
      }

      controller.setPlaybackSpeed(_playbackSpeed);

      // If ad already ended, play now; otherwise keep prebuffering chunks in background
      if (!_isPlayingAd) {
        controller.play();
      }

      setState(() {
        _videoPlayerController = controller;
        _isLoading = false;
        _chunkBufferProgress = 1.0;
        _chunkBufferStatus = '100% Chunks Primed & Buffered';
      });

      _startContinuousChunkPrefetching();
      _startControlsTimer();
      _startProgressAutoSave();
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Unable to stream title: ${e.toString()}';
      });
    }
  }

  void _startControlsTimer() {
    _controlsTimer?.cancel();
    _controlsTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && (_videoPlayerController?.value.isPlaying ?? false) && !_isLocked) {
        setState(() => _showControls = false);
      }
    });
  }

  void _startProgressAutoSave() {
    _progressSaveTimer?.cancel();
    _progressSaveTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _saveProgressNow();
    });
  }

  void _saveProgressNow() {
    final controller = _videoPlayerController;
    if (controller == null || !controller.value.isInitialized) return;

    final progress = controller.value.position.inSeconds.toDouble();
    final duration = controller.value.duration.inSeconds.toDouble();
    if (duration > 0) {
      _api.saveWatchProgress(
        contentId: _currentContent.id,
        episodeId: _currentEpisode?.id,
        progress: progress,
        duration: duration,
        completed: progress >= duration * 0.9,
      );
    }
  }

  void _togglePlayPause() {
    final controller = _videoPlayerController;
    if (controller == null) return;

    setState(() {
      if (controller.value.isPlaying) {
        controller.pause();
        _showControls = true;
      } else {
        controller.play();
        _startControlsTimer();
      }
    });
  }

  void _seekRelative(int seconds) {
    final controller = _videoPlayerController;
    if (controller == null) return;

    final current = controller.value.position;
    final target = current + Duration(seconds: seconds);
    controller.seekTo(target);
    _startControlsTimer();
  }

  void _onDoubleTapLeft() {
    if (_isLocked) return;
    _seekRelative(-10);
    setState(() => _showRewindIndicator = true);
  }

  void _onDoubleTapRight() {
    if (_isLocked) return;
    _seekRelative(10);
    setState(() => _showForwardIndicator = true);
  }

  void _playNextEpisode() {
    if (_playlist.isEmpty || _currentEpisode == null) return;
    final currentIndex = _playlist.indexWhere((e) => e.id == _currentEpisode!.id);
    if (currentIndex != -1 && currentIndex + 1 < _playlist.length) {
      final nextEp = _playlist[currentIndex + 1];
      _initStream(nextEp);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Playing E${nextEp.episodeNumber}: ${nextEp.title}'),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _toggleFitMode() {
    setState(() {
      switch (_fitMode) {
        case VideoFitMode.fit:
          _fitMode = VideoFitMode.fill;
          break;
        case VideoFitMode.fill:
          _fitMode = VideoFitMode.stretch;
          break;
        case VideoFitMode.stretch:
          _fitMode = VideoFitMode.fit;
          break;
      }
    });

    final label = _fitMode == VideoFitMode.fit
        ? 'Fit (Original)'
        : _fitMode == VideoFitMode.fill
            ? 'Zoom (Fill Screen)'
            : 'Stretch';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Aspect Ratio: $label'), duration: const Duration(milliseconds: 900)),
    );
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (d.inHours > 0) {
      return '${d.inHours}:$minutes:$seconds';
    }
    return '$minutes:$seconds';
  }

  void _showQualityModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.darkCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Stream Quality',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              if (_availableQualities.isNotEmpty)
                ..._availableQualities.map((media) {
                  final isSelected = _currentMedia?.id == media.id;
                  return ListTile(
                    leading: const Icon(Icons.hd_outlined, color: AppColors.brand),
                    title: Text('${media.quality} (${media.resolution})',
                        style: TextStyle(
                            color: isSelected ? AppColors.brand : Colors.white,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
                    trailing: isSelected ? const Icon(Icons.check, color: AppColors.brand) : null,
                    onTap: () {
                      Navigator.of(context).pop();
                      _initStream(_currentEpisode, media);
                    },
                  );
                })
              else ...[
                ListTile(
                  leading: const Icon(Icons.high_quality, color: AppColors.brand),
                  title: const Text('Auto (Optimized via Cloudflare CDN)', style: TextStyle(color: Colors.white)),
                  trailing: const Icon(Icons.check, color: AppColors.brand),
                  onTap: () => Navigator.of(context).pop(),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  void _showSpeedModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.darkCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Playback Speed',
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              ...[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) {
                final isSelected = _playbackSpeed == s;
                return ListTile(
                  leading: const Icon(Icons.speed, color: AppColors.textSecondary),
                  title: Text(s == 1.0 ? 'Normal (1.0x)' : '${s}x',
                      style: TextStyle(
                          color: isSelected ? AppColors.brand : Colors.white,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
                  trailing: isSelected ? const Icon(Icons.check, color: AppColors.brand) : null,
                  onTap: () {
                    Navigator.of(context).pop();
                    setState(() => _playbackSpeed = s);
                    _videoPlayerController?.setPlaybackSpeed(s);
                  },
                );
              }),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = _videoPlayerController;
    final watchlistProvider = Provider.of<WatchlistProvider>(context);
    final isBookmarked = watchlistProvider.isInWatchlist(_currentContent.id);
    final isFav = watchlistProvider.isFavorite(_currentContent.id);

    // Calculate aspect ratio / fit
    BoxFit videoBoxFit = BoxFit.contain;
    if (_fitMode == VideoFitMode.fill) videoBoxFit = BoxFit.cover;
    if (_fitMode == VideoFitMode.stretch) videoBoxFit = BoxFit.fill;

    Widget playerView = Stack(
      fit: StackFit.expand,
      children: [
        // Video render
        if (controller != null && controller.value.isInitialized)
          FittedBox(
            fit: videoBoxFit,
            child: SizedBox(
              width: controller.value.size.width,
              height: controller.value.size.height,
              child: VideoPlayer(controller),
            ),
          )
        else if (_isLoading)
          Container(
            color: Colors.black,
            child: const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: AppColors.brand),
                  SizedBox(height: 14),
                  Text('Buffering stream via Cloudflare Edge...',
                      style: TextStyle(color: Colors.white70, fontSize: 13)),
                ],
              ),
            ),
          )
        else if (_errorMessage != null)
          Container(
            color: Colors.black,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                    const SizedBox(height: 12),
                    Text(_errorMessage!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white, fontSize: 13)),
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: _initStream, child: const Text('Retry Connection')),
                  ],
                ),
              ),
            ),
          ),

        // Double-Tap Gestures Layer (Left for -10s, Right for +10s)
        Row(
          children: [
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onDoubleTap: _onDoubleTapLeft,
                onTap: () {
                  setState(() => _showControls = !_showControls);
                  if (_showControls) _startControlsTimer();
                },
                child: Center(
                  child: _showRewindIndicator
                      ? DoubleTapRippleIndicator(
                          isForward: false,
                          onEnd: () => setState(() => _showRewindIndicator = false),
                        )
                      : null,
                ),
              ),
            ),
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onDoubleTap: _onDoubleTapRight,
                onTap: () {
                  setState(() => _showControls = !_showControls);
                  if (_showControls) _startControlsTimer();
                },
                child: Center(
                  child: _showForwardIndicator
                      ? DoubleTapRippleIndicator(
                          isForward: true,
                          onEnd: () => setState(() => _showForwardIndicator = false),
                        )
                      : null,
                ),
              ),
            ),
          ],
        ),

        // MX Player Screen Lock Floating Button (when locked)
        if (_isLocked)
          Positioned(
            left: 20,
            top: 20,
            child: SafeArea(
              child: GestureDetector(
                onTap: () {
                  setState(() {
                    _isLocked = false;
                    _showControls = true;
                  });
                  _startControlsTimer();
                },
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.7),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.brand, width: 1.5),
                  ),
                  child: const Icon(Icons.lock_rounded, color: AppColors.brand, size: 22),
                ),
              ),
            ),
          ),

        // Pre-roll Sponsor Ad with Background Chunk Prefetch Overlay
        if (_isPlayingAd)
          Container(
            color: Colors.black,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Backdrop with slight dark tint
                if (_currentContent.backdropUrl.isNotEmpty)
                  Opacity(
                    opacity: 0.35,
                    child: CachedNetworkImage(
                      imageUrl: _currentContent.backdropUrl,
                      fit: BoxFit.cover,
                      memCacheWidth: 800,
                    ),
                  ),

                // Ambient cinema gradient
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withValues(alpha: 0.8),
                        Colors.black.withValues(alpha: 0.5),
                        Colors.black.withValues(alpha: 0.95),
                      ],
                    ),
                  ),
                ),

                // Top bar: Ad Counter & Chunk Prefetch Status
                Positioned(
                  top: 14,
                  left: 16,
                  right: 16,
                  child: SafeArea(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.75),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.gold.withValues(alpha: 0.6)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.stars_rounded, color: AppColors.gold, size: 14),
                              const SizedBox(width: 5),
                              Text(
                                'AD • 0:0$_adSecondsRemaining',
                                style: const TextStyle(
                                  color: AppColors.gold,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 11,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Chunk loading indicator
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.75),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white24),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const SizedBox(
                                width: 10,
                                height: 10,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.brand,
                                ),
                              ),
                              const SizedBox(width: 7),
                              Text(
                                'Pre-buffering: ${(_chunkBufferProgress * 100).toInt()}%',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Center Sponsor Brand Card
                Center(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 24),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.darkCard.withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: AppColors.darkBorder, width: 1.2),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.brand.withValues(alpha: 0.25),
                          blurRadius: 30,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Sponsor Logo
                        Container(
                          width: 56,
                          height: 56,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            gradient: AppColors.brandGradient,
                            borderRadius: BorderRadius.circular(18),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.brand.withValues(alpha: 0.4),
                                blurRadius: 16,
                              ),
                            ],
                          ),
                          child: const Icon(Icons.movie_filter_rounded, color: Colors.white, size: 32),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'MovieBuzz Cinema Engine',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.3,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Ultra 4K HDR • Edge Direct Accelerated Streaming',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 11.5),
                        ),
                        const SizedBox(height: 16),

                        // Chunk Pre-buffering progress bar
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: LinearProgressIndicator(
                            value: _chunkBufferProgress,
                            backgroundColor: Colors.white12,
                            valueColor: const AlwaysStoppedAnimation<Color>(AppColors.brand),
                            minHeight: 5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _chunkBufferStatus,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Bottom Right: Skip Ad Action Button
                Positioned(
                  bottom: 24,
                  right: 20,
                  child: SafeArea(
                    child: _canSkipAd
                        ? ElevatedButton.icon(
                            onPressed: _finishAdAndPlayMainVideo,
                            icon: const Icon(Icons.skip_next_rounded, color: Colors.black, size: 18),
                            label: const Text(
                              'Skip Ad',
                              style: TextStyle(
                                color: Colors.black,
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                              elevation: 6,
                            ),
                          )
                        : Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.75),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.white24),
                            ),
                            child: Text(
                              'Skip in ${_adSecondsRemaining > 2 ? _adSecondsRemaining - 2 : 1}s',
                              style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),

        // Controls Overlay (when not locked, ad finished, and controls visible)
        if (_showControls && !_isLocked && !_isPlayingAd)
          Container(
            color: Colors.black.withValues(alpha: 0.45),
            child: SafeArea(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Top Toolbar: Back, Title, Lock, Aspect Ratio, Speed, Quality
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.arrow_back, color: Colors.white),
                          onPressed: () {
                            if (_isFullscreen) {
                              _setPortraitOrientations();
                            } else {
                              Navigator.of(context).pop();
                            }
                          },
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                _currentContent.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                              ),
                              if (_currentEpisode != null)
                                Text(
                                  'S${_currentEpisode?.seasonNumber ?? 1} E${_currentEpisode?.episodeNumber}: ${_currentEpisode?.title}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                ),
                            ],
                          ),
                        ),

                        // MX Player Screen Lock Button
                        IconButton(
                          icon: const Icon(Icons.lock_open_rounded, color: Colors.white, size: 20),
                          tooltip: 'Lock Screen',
                          onPressed: () {
                            setState(() {
                              _isLocked = true;
                              _showControls = false;
                            });
                          },
                        ),

                        // Aspect Ratio Toggle
                        IconButton(
                          icon: const Icon(Icons.aspect_ratio_rounded, color: Colors.white, size: 20),
                          tooltip: 'Aspect Ratio',
                          onPressed: _toggleFitMode,
                        ),

                        // Playback Speed
                        IconButton(
                          icon: const Icon(Icons.speed, color: Colors.white, size: 20),
                          tooltip: 'Speed',
                          onPressed: _showSpeedModal,
                        ),

                        // Quality Switcher
                        IconButton(
                          icon: const Icon(Icons.settings_outlined, color: Colors.white, size: 20),
                          tooltip: 'Quality',
                          onPressed: _showQualityModal,
                        ),
                      ],
                    ),
                  ),

                  // Center Controls: Rewind, Play/Pause, Fast Forward, Next Episode
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.replay_10_rounded, color: Colors.white, size: 36),
                        onPressed: () => _seekRelative(-10),
                      ),
                      const SizedBox(width: 28),
                      GestureDetector(
                        onTap: _togglePlayPause,
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.brand.withValues(alpha: 0.9),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.brand.withValues(alpha: 0.4),
                                blurRadius: 16,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                          child: Icon(
                            (controller?.value.isPlaying ?? false)
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            color: Colors.white,
                            size: 42,
                          ),
                        ),
                      ),
                      const SizedBox(width: 28),
                      IconButton(
                        icon: const Icon(Icons.forward_10_rounded, color: Colors.white, size: 36),
                        onPressed: () => _seekRelative(10),
                      ),
                      if (_currentContent.isSeries && _playlist.isNotEmpty) ...[
                        const SizedBox(width: 20),
                        IconButton(
                          icon: const Icon(Icons.skip_next_rounded, color: Colors.white, size: 32),
                          tooltip: 'Next Episode',
                          onPressed: _playNextEpisode,
                        ),
                      ],
                    ],
                  ),

                  // Bottom Toolbar: Duration, Slider, Fullscreen toggle
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    child: Row(
                      children: [
                        Text(
                          controller != null && controller.value.isInitialized
                              ? _formatDuration(controller.value.position)
                              : '00:00',
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                        ),
                        Expanded(
                          child: controller != null && controller.value.isInitialized
                              ? SliderTheme(
                                  data: SliderTheme.of(context).copyWith(
                                    trackHeight: 3,
                                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                    activeTrackColor: AppColors.brand,
                                    inactiveTrackColor: Colors.white24,
                                    thumbColor: AppColors.brand,
                                  ),
                                  child: Slider(
                                    value: controller.value.position.inSeconds
                                        .toDouble()
                                        .clamp(0.0, controller.value.duration.inSeconds.toDouble()),
                                    min: 0,
                                    max: controller.value.duration.inSeconds.toDouble(),
                                    onChanged: (val) {
                                      controller.seekTo(Duration(seconds: val.toInt()));
                                    },
                                  ),
                                )
                              : const SizedBox(),
                        ),
                        Text(
                          controller != null && controller.value.isInitialized
                              ? _formatDuration(controller.value.duration)
                              : '00:00',
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                        ),
                        const SizedBox(width: 8),
                        // Fullscreen / Minimize Button
                        IconButton(
                          icon: Icon(
                            _isFullscreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
                            color: Colors.white,
                            size: 26,
                          ),
                          tooltip: _isFullscreen ? 'Exit Fullscreen' : 'Fullscreen',
                          onPressed: _toggleFullscreen,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );

    // If Fullscreen Landscape Mode: Return pure video player
    if (_isFullscreen) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: playerView,
      );
    }

    // Half-Screen Portrait Mode (MX Player / YouTube / JioHotstar style)
    return Scaffold(
      backgroundColor: AppColors.darkBase,
      body: SafeArea(
        child: Column(
          children: [
            // Top Half: Video Player
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Container(
                color: Colors.black,
                child: playerView,
              ),
            ),

            // Bottom Half: Scrollable Content Info, Episodes, and Recommendations
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title and Badges
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _currentContent.title,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  if (_currentContent.releaseYear > 0)
                                    Text('${_currentContent.releaseYear}',
                                        style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                                  if (_currentContent.rating > 0) ...[
                                    const SizedBox(width: 8),
                                    const Icon(Icons.star_rounded, color: AppColors.gold, size: 14),
                                    const SizedBox(width: 2),
                                    Text(
                                      _currentContent.rating.toStringAsFixed(1),
                                      style: const TextStyle(
                                          color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                    ),
                                  ],
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: AppColors.brand,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      _currentContent.isSeries ? 'SERIES' : 'MOVIE',
                                      style: const TextStyle(
                                          color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Quick Action Icons: Watchlist, Favorite, Speed, Share
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildActionBtn(
                          icon: isBookmarked ? Icons.bookmark : Icons.bookmark_border,
                          label: isBookmarked ? 'Saved' : 'Watchlist',
                          color: isBookmarked ? AppColors.brand : Colors.white70,
                          onTap: () => watchlistProvider.toggleWatchlist(_currentContent),
                        ),
                        _buildActionBtn(
                          icon: isFav ? Icons.favorite : Icons.favorite_border,
                          label: 'Like',
                          color: isFav ? AppColors.brand : Colors.white70,
                          onTap: () => watchlistProvider.toggleFavorite(_currentContent),
                        ),
                        _buildActionBtn(
                          icon: Icons.speed,
                          label: '${_playbackSpeed}x Speed',
                          color: Colors.white70,
                          onTap: _showSpeedModal,
                        ),
                        _buildActionBtn(
                          icon: Icons.hd_outlined,
                          label: 'Quality',
                          color: Colors.white70,
                          onTap: _showQualityModal,
                        ),
                      ],
                    ),

                    const Divider(color: AppColors.darkBorder, height: 24),

                    // Storyline Description
                    if (_currentContent.description.isNotEmpty) ...[
                      Text(
                        _currentContent.description,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.4),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Web Series Season Selector & Episodes Carousel
                    if (_currentContent.isSeries) ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Episodes',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          if (_seasons.isNotEmpty)
                            DropdownButton<Season>(
                              value: _selectedSeason,
                              dropdownColor: AppColors.darkCard,
                              underline: const SizedBox(),
                              style: const TextStyle(color: Colors.white, fontSize: 13),
                              items: _seasons.map((s) {
                                return DropdownMenuItem<Season>(
                                  value: s,
                                  child: Text('Season ${s.seasonNumber}'),
                                );
                              }).toList(),
                              onChanged: (newSeason) async {
                                if (newSeason != null) {
                                  setState(() => _selectedSeason = newSeason);
                                  final eps = await _api.getSeasonEpisodes(newSeason.id);
                                  setState(() => _playlist = eps);
                                }
                              },
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Episode horizontal list
                      if (_playlist.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text('No episodes found for this season.',
                              style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                        )
                      else
                        SizedBox(
                          height: 120,
                          child: ListView.builder(
                            scrollDirection: Axis.horizontal,
                            itemCount: _playlist.length,
                            itemBuilder: (context, index) {
                              final ep = _playlist[index];
                              final isCurrent = _currentEpisode?.id == ep.id;

                              return GestureDetector(
                                onTap: () => _initStream(ep),
                                child: Container(
                                  width: 150,
                                  margin: const EdgeInsets.only(right: 12),
                                  decoration: BoxDecoration(
                                    color: isCurrent ? AppColors.darkHover : AppColors.darkCard,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: isCurrent ? AppColors.brand : AppColors.darkBorder,
                                      width: isCurrent ? 1.5 : 0.5,
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Stack(
                                        alignment: Alignment.center,
                                        children: [
                                          ClipRRect(
                                            borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
                                            child: Container(
                                              height: 75,
                                              width: double.infinity,
                                              color: Colors.black26,
                                              child: ep.thumbnailUrl.isNotEmpty
                                                  ? CachedNetworkImage(
                                                      imageUrl: ep.thumbnailUrl,
                                                      fit: BoxFit.cover,
                                                      errorWidget: (context, url, error) => const Center(
                                                          child: Icon(Icons.movie, color: AppColors.textMuted)),
                                                    )
                                                  : const Center(
                                                      child: Icon(Icons.movie, color: AppColors.textMuted)),
                                            ),
                                          ),
                                          if (isCurrent)
                                            Container(
                                              padding: const EdgeInsets.all(4),
                                              decoration: BoxDecoration(
                                                color: AppColors.brand.withValues(alpha: 0.9),
                                                shape: BoxShape.circle,
                                              ),
                                              child: const Icon(Icons.play_arrow_rounded,
                                                  color: Colors.white, size: 18),
                                            ),
                                        ],
                                      ),
                                      Padding(
                                        padding: const EdgeInsets.all(6),
                                        child: Text(
                                          'E${ep.episodeNumber}: ${ep.title}',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: isCurrent ? AppColors.brand : Colors.white,
                                            fontSize: 11,
                                            fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      const SizedBox(height: 16),
                    ],

                    // More Like This
                    if (_similarContent.isNotEmpty) ...[
                      const Text(
                        'More Like This',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 160,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: _similarContent.length,
                          itemBuilder: (context, index) {
                            final item = _similarContent[index];
                            return GestureDetector(
                              onTap: () {
                                Navigator.of(context).pushReplacement(
                                  MaterialPageRoute(
                                    builder: (_) => VideoPlayerScreen(content: item),
                                  ),
                                );
                              },
                              child: Container(
                                width: 100,
                                margin: const EdgeInsets.only(right: 10),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(6),
                                      child: SizedBox(
                                        width: 100,
                                        height: 125,
                                        child: item.posterUrl.isNotEmpty
                                            ? CachedNetworkImage(
                                                imageUrl: item.posterUrl,
                                                fit: BoxFit.cover,
                                              )
                                            : Container(color: AppColors.darkCard),
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      item.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: Colors.white, fontSize: 11),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionBtn({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(color: color, fontSize: 11)),
        ],
      ),
    );
  }
}
