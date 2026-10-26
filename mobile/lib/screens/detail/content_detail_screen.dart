import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../constants/app_colors.dart';
import '../../models/content.dart';
import '../../models/season.dart';
import '../../models/episode.dart';
import '../../models/media.dart';
import '../../services/api_service.dart';
import '../../providers/watchlist_provider.dart';
import '../../services/offline_storage_service.dart';
import '../../services/download_service.dart';
import '../downloads/downloads_screen.dart';
import '../player/video_player_screen.dart';
import '../../widgets/shimmer_loading.dart';

class ContentDetailScreen extends StatefulWidget {
  final Content content;
  final bool autoPlay;

  const ContentDetailScreen({
    super.key,
    required this.content,
    this.autoPlay = false,
  });

  @override
  State<ContentDetailScreen> createState() => _ContentDetailScreenState();
}

class _ContentDetailScreenState extends State<ContentDetailScreen> {
  final ApiService _api = ApiService();

  List<Media> _mediaList = [];
  List<Season> _seasons = [];
  List<Episode> _episodes = [];
  Season? _selectedSeason;
  bool _isLoadingEpisodes = false;
  Set<String> _downloadedIds = {};

  @override
  void initState() {
    super.initState();
    _loadContentDetails();
    _checkDownloads();
  }

  Future<void> _checkDownloads() async {
    final downloads = await OfflineStorageService.getDownloads();
    if (mounted) {
      setState(() {
        _downloadedIds = downloads.map((d) => d.id).toSet();
      });
    }
  }

  Future<void> _loadContentDetails() async {
    try {
      if (widget.content.isMovie) {
        // Fetch media streams for movie
        final details = await _api.getContentBySlug(widget.content.slug);
        setState(() {
          _mediaList = details['media'] as List<Media>;
        });

        if (widget.autoPlay && _mediaList.isNotEmpty) {
          _playMovie();
        }
      } else {
        // Fetch seasons for series
        final seasons = await _api.getSeriesSeasons(widget.content.id);
        setState(() {
          _seasons = seasons;
          if (_seasons.isNotEmpty) {
            _selectedSeason = _seasons.first;
          }
        });

        if (_selectedSeason != null) {
          _loadEpisodesForSeason(_selectedSeason!.id);
        }
      }
    } catch (_) {}
  }

  Future<void> _loadEpisodesForSeason(String seasonId) async {
    setState(() => _isLoadingEpisodes = true);
    try {
      final episodes = await _api.getSeasonEpisodes(seasonId);
      setState(() {
        _episodes = episodes;
        _isLoadingEpisodes = false;
      });

      if (widget.autoPlay && _episodes.isNotEmpty) {
        _playEpisode(_episodes.first);
      }
    } catch (_) {
      setState(() => _isLoadingEpisodes = false);
    }
  }

  void _playMovie([Media? selectedMedia]) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => VideoPlayerScreen(
          content: widget.content,
          initialMedia: selectedMedia ?? (_mediaList.isNotEmpty ? _mediaList.first : null),
        ),
      ),
    );
  }

  void _playEpisode(Episode episode) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => VideoPlayerScreen(
          content: widget.content,
          episode: episode,
          playlist: _episodes,
        ),
      ),
    );
  }

  Future<void> _handleMovieDownload() async {
    final movieId = 'movie-${widget.content.id}';
    if (_downloadedIds.contains(movieId)) {
      final item = await OfflineStorageService.getDownload(movieId);
      if (item != null && mounted) {
        showModalBottomSheet(
          context: context,
          backgroundColor: AppColors.darkCard,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
          builder: (ctx) => Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.content.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 6),
                Text('Downloaded in app storage • ${item.formattedSize}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                const SizedBox(height: 16),
                ListTile(
                  leading: const Icon(Icons.play_circle_fill, color: Colors.greenAccent, size: 28),
                  title: const Text('Play Offline Now', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  subtitle: const Text('Zero buffering • No internet required', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => VideoPlayerScreen(
                          content: widget.content,
                          offlineFilePath: item.localFilePath,
                        ),
                      ),
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 28),
                  title: const Text('Delete from Device Cache', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
                  onTap: () async {
                    Navigator.pop(ctx);
                    await OfflineStorageService.deleteDownload(movieId);
                    _checkDownloads();
                  },
                ),
              ],
            ),
          ),
        );
      }
      return;
    }

    final dlService = Provider.of<DownloadService>(context, listen: false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Starting download: "${widget.content.title}" in app storage...'),
        duration: const Duration(seconds: 2),
      ),
    );

    dlService.downloadMovie(
      content: widget.content,
      media: _mediaList.isNotEmpty ? _mediaList.first : null,
      onCompleted: () {
        _checkDownloads();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✅ "${widget.content.title}" downloaded! Available offline.'),
              duration: const Duration(seconds: 3),
              action: SnackBarAction(
                label: 'View',
                textColor: Colors.greenAccent,
                onPressed: () {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const DownloadsScreen()));
                },
              ),
            ),
          );
        }
      },
      onError: (err) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Download failed: $err'), backgroundColor: Colors.redAccent),
          );
        }
      },
    );
  }

  Future<void> _handleEpisodeDownload(Episode ep) async {
    final epId = 'series-${widget.content.id}-s${ep.seasonNumber}-e${ep.episodeNumber}';
    if (_downloadedIds.contains(epId)) {
      final item = await OfflineStorageService.getDownload(epId);
      if (item != null && mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => VideoPlayerScreen(
              content: widget.content,
              episode: ep,
              offlineFilePath: item.localFilePath,
            ),
          ),
        );
      }
      return;
    }

    final dlService = Provider.of<DownloadService>(context, listen: false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Downloading S${ep.seasonNumber} E${ep.episodeNumber} for offline playback...'),
        duration: const Duration(seconds: 2),
      ),
    );

    dlService.downloadEpisode(
      content: widget.content,
      episode: ep,
      onCompleted: () {
        _checkDownloads();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✅ S${ep.seasonNumber} E${ep.episodeNumber} downloaded! Available offline.'),
              duration: const Duration(seconds: 3),
            ),
          );
        }
      },
      onError: (err) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Download failed: $err'), backgroundColor: Colors.redAccent),
          );
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final content = widget.content;
    final watchlistProvider = Provider.of<WatchlistProvider>(context);
    final downloadService = Provider.of<DownloadService>(context);
    final isBookmarked = watchlistProvider.isInWatchlist(content.id);
    final isFav = watchlistProvider.isFavorite(content.id);

    final movieId = 'movie-${content.id}';
    final isMovieDownloaded = _downloadedIds.contains(movieId);
    final isMovieDownloading = downloadService.isDownloading(movieId);

    final backdrop = content.backdropUrl.isNotEmpty
        ? content.backdropUrl
        : content.posterUrl;

    return Scaffold(
      backgroundColor: AppColors.darkBase,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          // Collapsible Backdrop Banner
          SliverAppBar(
            expandedHeight: 280,
            pinned: true,
            backgroundColor: AppColors.darkBase,
            actions: [
              IconButton(
                icon: const Icon(Icons.download_for_offline_rounded, color: Colors.white),
                tooltip: 'Offline Downloads',
                onPressed: () {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const DownloadsScreen()));
                },
              ),
            ],
            leading: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.55),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
              ),
              onPressed: () => Navigator.of(context).pop(),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  backdrop.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: backdrop,
                          fit: BoxFit.cover,
                          memCacheWidth: 900,
                          maxWidthDiskCache: 1400,
                          fadeInDuration: const Duration(milliseconds: 250),
                          placeholder: (_, __) => Container(color: AppColors.darkCard),
                          errorWidget: (_, __, ___) => Container(color: AppColors.darkCard),
                        )
                      : Container(color: AppColors.darkCard),

                  // Gradient
                  Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.transparent,
                          Color(0x8009090B),
                          Color(0xFF09090B),
                        ],
                        stops: [0.3, 0.7, 1.0],
                      ),
                    ),
                  ),

                  // Center Play Action
                  Center(
                    child: GestureDetector(
                      onTap: () {
                        if (content.isMovie) {
                          _playMovie();
                        } else if (_episodes.isNotEmpty) {
                          _playEpisode(_episodes.first);
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.brand.withValues(alpha: 0.9),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.brand.withValues(alpha: 0.5),
                              blurRadius: 20,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 36,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Content Details Body
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Badges: Type, Rating, Year
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.brand,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          content.isSeries ? 'SERIES' : 'MOVIE',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      if (content.rating > 0) ...[
                        const SizedBox(width: 8),
                        const Icon(Icons.star_rounded, color: AppColors.gold, size: 16),
                        const SizedBox(width: 3),
                        Text(
                          content.rating.toStringAsFixed(1),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                      if (content.releaseYear > 0) ...[
                        const SizedBox(width: 8),
                        Text(
                          '${content.releaseYear}',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                        ),
                      ],
                    ],
                  ),

                  const SizedBox(height: 10),

                  // Title
                  Text(
                    content.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      height: 1.25,
                    ),
                  ),

                  const SizedBox(height: 8),

                  // Genres
                  if (content.genres.isNotEmpty)
                    Text(
                      content.genres.join(' • '),
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),

                  const SizedBox(height: 16),

                  // Primary Action Buttons: Play + Watchlist + Favorite
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            if (content.isMovie) {
                              _playMovie();
                            } else if (_episodes.isNotEmpty) {
                              _playEpisode(_episodes.first);
                            }
                          },
                          icon: const Icon(Icons.play_arrow_rounded, size: 22),
                          label: Text(
                            content.isMovie ? 'Play Movie' : 'Play First Episode',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                      if (content.isMovie) ...[
                        const SizedBox(width: 10),
                        IconButton(
                          onPressed: _handleMovieDownload,
                          style: IconButton.styleFrom(
                            backgroundColor: isMovieDownloaded
                                ? Colors.greenAccent.withValues(alpha: 0.15)
                                : AppColors.darkCard,
                            side: BorderSide(
                              color: isMovieDownloaded ? Colors.greenAccent : AppColors.darkBorder,
                            ),
                          ),
                          icon: isMovieDownloading
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brand),
                                )
                              : Icon(
                                  isMovieDownloaded ? Icons.download_done_rounded : Icons.download_rounded,
                                  color: isMovieDownloaded ? Colors.greenAccent : Colors.white,
                                ),
                          tooltip: isMovieDownloaded ? 'Downloaded (Play Offline)' : 'Download Movie',
                        ),
                      ] else ...[
                        const SizedBox(width: 10),
                        Builder(
                          builder: (context) {
                            final firstEpId = _episodes.isNotEmpty
                                ? 'series-${content.id}-s${_episodes.first.seasonNumber}-e${_episodes.first.episodeNumber}'
                                : '';
                            final isFirstEpDownloaded = firstEpId.isNotEmpty && _downloadedIds.contains(firstEpId);
                            final isFirstEpDownloading = firstEpId.isNotEmpty && downloadService.isDownloading(firstEpId);

                            return IconButton(
                              onPressed: () {
                                if (_episodes.isNotEmpty) {
                                  _handleEpisodeDownload(_episodes.first);
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Loading episodes for download...')),
                                  );
                                }
                              },
                              style: IconButton.styleFrom(
                                backgroundColor: isFirstEpDownloaded
                                    ? Colors.greenAccent.withValues(alpha: 0.15)
                                    : AppColors.darkCard,
                                side: BorderSide(
                                  color: isFirstEpDownloaded ? Colors.greenAccent : AppColors.darkBorder,
                                ),
                              ),
                              icon: isFirstEpDownloading
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brand),
                                    )
                                  : Icon(
                                      isFirstEpDownloaded ? Icons.download_done_rounded : Icons.download_rounded,
                                      color: isFirstEpDownloaded ? Colors.greenAccent : Colors.white,
                                    ),
                              tooltip: isFirstEpDownloaded ? 'Downloaded (Play Offline)' : 'Download Episode',
                            );
                          },
                        ),
                      ],
                      const SizedBox(width: 10),
                      IconButton(
                        onPressed: () {
                          watchlistProvider.toggleWatchlist(content);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                isBookmarked ? 'Removed from Watchlist' : 'Added to Watchlist',
                              ),
                              duration: const Duration(seconds: 1),
                            ),
                          );
                        },
                        style: IconButton.styleFrom(
                          backgroundColor: AppColors.darkCard,
                          side: const BorderSide(color: AppColors.darkBorder),
                        ),
                        icon: Icon(
                          isBookmarked ? Icons.bookmark : Icons.bookmark_border,
                          color: isBookmarked ? AppColors.brand : Colors.white,
                        ),
                      ),
                      IconButton(
                        onPressed: () {
                          watchlistProvider.toggleFavorite(content);
                        },
                        style: IconButton.styleFrom(
                          backgroundColor: AppColors.darkCard,
                          side: const BorderSide(color: AppColors.darkBorder),
                        ),
                        icon: Icon(
                          isFav ? Icons.favorite : Icons.favorite_border,
                          color: isFav ? AppColors.brand : Colors.white,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // Overview / Synopsis
                  if (content.description.isNotEmpty) ...[
                    const Text(
                      'Storyline',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      content.description,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // Cast & Crew
                  if (content.cast.isNotEmpty) ...[
                    const Text(
                      'Starring Cast',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      content.cast.join(', '),
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // If Movie: Available Streaming Qualities
                  if (content.isMovie && _mediaList.isNotEmpty) ...[
                    const Text(
                      'Available Streaming Qualities',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _mediaList.map((media) {
                        return ActionChip(
                          avatar: const Icon(Icons.hd_outlined, color: AppColors.brand, size: 18),
                          label: Text('${media.quality} (${media.resolution})'),
                          backgroundColor: AppColors.darkCard,
                          side: const BorderSide(color: AppColors.darkBorder),
                          labelStyle: const TextStyle(color: Colors.white, fontSize: 13),
                          onPressed: () => _playMovie(media),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // If Series: Seasons and Episode List
                  if (content.isSeries) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Episodes',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (_seasons.isNotEmpty)
                          DropdownButton<Season>(
                            value: _selectedSeason,
                            dropdownColor: AppColors.darkCard,
                            underline: const SizedBox(),
                            icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.brand),
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            items: _seasons.map((s) {
                              return DropdownMenuItem<Season>(
                                value: s,
                                child: Text('Season ${s.seasonNumber}'),
                              );
                            }).toList(),
                            onChanged: (newSeason) {
                              if (newSeason != null) {
                                setState(() => _selectedSeason = newSeason);
                                _loadEpisodesForSeason(newSeason.id);
                              }
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Episodes list
                    if (_isLoadingEpisodes)
                      Column(
                        children: List.generate(
                          3,
                          (_) => const Padding(
                            padding: EdgeInsets.only(bottom: 12.0),
                            child: ShimmerBox(width: double.infinity, height: 80),
                          ),
                        ),
                      )
                    else if (_episodes.isEmpty)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24.0),
                          child: Text(
                            'No episodes available for this season yet.',
                            style: TextStyle(color: AppColors.textMuted),
                          ),
                        ),
                      )
                    else
                      ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _episodes.length,
                        itemBuilder: (context, index) {
                          final ep = _episodes[index];
                          final epThumbnail = ep.thumbnailUrl.isNotEmpty
                              ? ep.thumbnailUrl
                              : backdrop;

                          return GestureDetector(
                            onTap: () => _playEpisode(ep),
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppColors.darkCard,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.darkBorder, width: 0.5),
                              ),
                              child: Row(
                                children: [
                                  // Thumbnail
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(6),
                                    child: Stack(
                                      alignment: Alignment.center,
                                      children: [
                                        Container(
                                          width: 110,
                                          height: 65,
                                          color: Colors.black26,
                                          child: epThumbnail.isNotEmpty
                                              ? CachedNetworkImage(
                                                  imageUrl: epThumbnail,
                                                  fit: BoxFit.cover,
                                                  memCacheWidth: 260,
                                                  maxWidthDiskCache: 500,
                                                  fadeInDuration: const Duration(milliseconds: 180),
                                                  placeholder: (_, __) =>
                                                      const ShimmerBox(width: 110, height: 65),
                                                  errorWidget: (_, __, ___) => const Center(
                                                    child: Icon(Icons.movie,
                                                        color: AppColors.textMuted),
                                                  ),
                                                )
                                              : const Center(
                                                  child: Icon(Icons.movie,
                                                      color: AppColors.textMuted),
                                                ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.all(4),
                                          decoration: BoxDecoration(
                                            color: Colors.black.withValues(alpha: 0.6),
                                            shape: BoxShape.circle,
                                          ),
                                          child: const Icon(
                                            Icons.play_arrow_rounded,
                                            color: Colors.white,
                                            size: 20,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),

                                  // Details
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'E${ep.episodeNumber}: ${ep.title}',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                          ),
                                        ),
                                        if (ep.duration > 0) ...[
                                          const SizedBox(height: 4),
                                          Text(
                                            '${(ep.duration / 60).round()} min',
                                            style: const TextStyle(
                                              color: AppColors.textMuted,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                        if (ep.description != null &&
                                            ep.description!.isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          Text(
                                            ep.description!,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: AppColors.textSecondary,
                                              fontSize: 11,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),

                                  // Episode Download Button
                                  Builder(builder: (context) {
                                    final epId = 'series-${content.id}-s${ep.seasonNumber}-e${ep.episodeNumber}';
                                    final isEpDownloaded = _downloadedIds.contains(epId);
                                    final isEpDownloading = downloadService.isDownloading(epId);

                                    return IconButton(
                                      icon: isEpDownloading
                                          ? const SizedBox(
                                              width: 18,
                                              height: 18,
                                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brand),
                                            )
                                          : Icon(
                                              isEpDownloaded ? Icons.download_done_rounded : Icons.download_rounded,
                                              color: isEpDownloaded ? Colors.greenAccent : AppColors.textSecondary,
                                              size: 22,
                                            ),
                                      onPressed: () => _handleEpisodeDownload(ep),
                                      tooltip: isEpDownloaded ? 'Downloaded (Play Offline)' : 'Download Episode',
                                    );
                                  }),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
