import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../../models/content.dart';
import '../../../constants/app_colors.dart';
import '../../../providers/watchlist_provider.dart';
import '../../player/video_player_screen.dart';
import '../../detail/content_detail_screen.dart';

class HeroBanner extends StatefulWidget {
  final List<Content> items;

  const HeroBanner({super.key, required this.items});

  @override
  State<HeroBanner> createState() => _HeroBannerState();
}

class _HeroBannerState extends State<HeroBanner> {
  late final PageController _pageController;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.92);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();

    final watchlistProvider = Provider.of<WatchlistProvider>(context);

    return Column(
      children: [
        SizedBox(
          height: 460,
          child: PageView.builder(
            controller: _pageController,
            physics: const BouncingScrollPhysics(),
            itemCount: widget.items.length,
            onPageChanged: (index) => setState(() => _currentPage = index),
            itemBuilder: (context, index) {
              final item = widget.items[index];
              final isBookmarked = watchlistProvider.isInWatchlist(item.id);
              final imageUrl = item.backdropUrl.isNotEmpty
                  ? item.backdropUrl
                  : item.posterUrl;

              return AnimatedPadding(
                duration: const Duration(milliseconds: 250),
                padding: EdgeInsets.symmetric(
                  horizontal: 6,
                  vertical: _currentPage == index ? 0 : 8,
                ),
                child: GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ContentDetailScreen(content: item),
                      ),
                    );
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.6),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          // Poster / Backdrop Image
                          imageUrl.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: imageUrl,
                                  fit: BoxFit.cover,
                                  alignment: Alignment.topCenter,
                                  memCacheWidth: 900,
                                  maxWidthDiskCache: 1400,
                                  fadeInDuration: const Duration(milliseconds: 250),
                                  placeholder: (context, url) => Container(color: AppColors.darkCard),
                                  errorWidget: (context, url, error) => Container(color: AppColors.darkCard),
                                )
                              : Container(color: AppColors.darkCard),

                          // Multi-Stop Cinema Gradient
                          Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                stops: [0.0, 0.4, 0.7, 1.0],
                                colors: [
                                  Colors.transparent,
                                  Color(0x33000000),
                                  Color(0xCC09090D),
                                  Color(0xFF09090D),
                                ],
                              ),
                            ),
                          ),

                          // Top-Left Spotlight Badge
                          Positioned(
                            top: 16,
                            left: 16,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.6),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.15),
                                  width: 0.8,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 6,
                                    height: 6,
                                    decoration: const BoxDecoration(
                                      color: AppColors.brand,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    item.isSeries ? 'SERIES SPOTLIGHT' : 'FEATURED MOVIE',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.6,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          // Bottom Content Info & Action Buttons
                          Positioned(
                            left: 18,
                            right: 18,
                            bottom: 18,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Title
                                Text(
                                  item.title,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 26,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -0.5,
                                    shadows: [
                                      Shadow(color: Colors.black87, blurRadius: 10, offset: Offset(0, 2)),
                                    ],
                                  ),
                                ),

                                const SizedBox(height: 6),

                                // Metadata Row: Rating, Year, Quality, Genres
                                Row(
                                  children: [
                                    if (item.rating > 0) ...[
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppColors.gold.withValues(alpha: 0.2),
                                          borderRadius: BorderRadius.circular(4),
                                          border: Border.all(color: AppColors.gold.withValues(alpha: 0.4), width: 0.8),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Icon(Icons.star_rounded, color: AppColors.gold, size: 13),
                                            const SizedBox(width: 3),
                                            Text(
                                              item.rating.toStringAsFixed(1),
                                              style: const TextStyle(
                                                color: AppColors.gold,
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                    ],

                                    if (item.releaseYear > 0) ...[
                                      Text(
                                        '${item.releaseYear}',
                                        style: const TextStyle(color: Color(0xFFD1D5DB), fontSize: 12, fontWeight: FontWeight.w600),
                                      ),
                                      const SizedBox(width: 8),
                                    ],

                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(3),
                                        border: Border.all(color: Colors.white24, width: 0.8),
                                      ),
                                      child: const Text(
                                        '4K UHD',
                                        style: TextStyle(color: Colors.white70, fontSize: 9.5, fontWeight: FontWeight.bold),
                                      ),
                                    ),

                                    if (item.genres.isNotEmpty) ...[
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          item.genres.take(2).join(' • '),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 11.5),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),

                                const SizedBox(height: 16),

                                // Action Buttons: [ ▶ Watch Now ] and [ + My List ]
                                Row(
                                  children: [
                                    // Primary Watch Button
                                    Expanded(
                                      flex: 3,
                                      child: ElevatedButton.icon(
                                        onPressed: () {
                                          Navigator.of(context).push(
                                            MaterialPageRoute(
                                              builder: (_) => VideoPlayerScreen(content: item),
                                            ),
                                          );
                                        },
                                        icon: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 22),
                                        label: const Text(
                                          'Watch Now',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w800,
                                            fontSize: 14,
                                          ),
                                        ),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppColors.brand,
                                          elevation: 4,
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                        ),
                                      ),
                                    ),

                                    const SizedBox(width: 10),

                                    // Watchlist Button
                                    Expanded(
                                      flex: 2,
                                      child: OutlinedButton.icon(
                                        onPressed: () {
                                          watchlistProvider.toggleWatchlist(item);
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(
                                              content: Text(
                                                isBookmarked ? 'Removed from Watchlist' : 'Added to Watchlist',
                                              ),
                                              duration: const Duration(seconds: 1),
                                              behavior: SnackBarBehavior.floating,
                                            ),
                                          );
                                        },
                                        icon: Icon(
                                          isBookmarked ? Icons.check : Icons.add,
                                          color: isBookmarked ? AppColors.brand : Colors.white,
                                          size: 18,
                                        ),
                                        label: Text(
                                          isBookmarked ? 'Saved' : 'Watchlist',
                                          style: TextStyle(
                                            color: isBookmarked ? AppColors.brand : Colors.white,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        style: OutlinedButton.styleFrom(
                                          backgroundColor: Colors.white.withValues(alpha: 0.08),
                                          side: BorderSide(
                                            color: isBookmarked ? AppColors.brand : Colors.white.withValues(alpha: 0.2),
                                            width: 1,
                                          ),
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),

        // Carousel indicator pills
        if (widget.items.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                widget.items.length.clamp(0, 7),
                (index) {
                  final isActive = _currentPage == index;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: isActive ? 20 : 6,
                    height: 4,
                    decoration: BoxDecoration(
                      color: isActive ? AppColors.brand : Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  );
                },
              ),
            ),
          ),
      ],
    );
  }
}
