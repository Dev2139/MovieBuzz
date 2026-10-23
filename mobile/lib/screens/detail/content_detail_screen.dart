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

  @override
  void initState() {
    super.initState();
    _loadContentDetails();
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

  @override
  Widget build(BuildContext context) {
    final content = widget.content;
    final watchlistProvider = Provider.of<WatchlistProvider>(context);
    final isBookmarked = watchlistProvider.isInWatchlist(content.id);
    final isFav = watchlistProvider.isFavorite(content.id);

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
