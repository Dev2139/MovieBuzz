import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../models/content.dart';
import '../constants/app_colors.dart';
import '../providers/watchlist_provider.dart';
import '../screens/detail/content_detail_screen.dart';
import 'shimmer_loading.dart';

class ContentCard extends StatelessWidget {
  final Content content;
  final double width;
  final double height;
  final bool showRating;
  final bool isGrid;

  const ContentCard({
    super.key,
    required this.content,
    this.width = 130,
    this.height = 195,
    this.showRating = true,
    this.isGrid = false,
  });

  @override
  Widget build(BuildContext context) {
    final watchlistProvider = Provider.of<WatchlistProvider>(context);
    final isBookmarked = watchlistProvider.isInWatchlist(content.id);

    Widget posterStack = Stack(
      children: [
        Positioned.fill(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Container(
              color: AppColors.darkCard,
              child: content.posterUrl.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: content.posterUrl,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => const ShimmerBox(width: double.infinity, height: double.infinity),
                      errorWidget: (_, __, ___) => Center(
                        child: Icon(
                          content.isSeries ? Icons.tv : Icons.movie,
                          color: AppColors.textMuted,
                          size: 32,
                        ),
                      ),
                    )
                  : Center(
                      child: Icon(
                        content.isSeries ? Icons.tv : Icons.movie,
                        color: AppColors.textMuted,
                        size: 32,
                      ),
                    ),
            ),
          ),
        ),

        // Top right: Watchlist quick toggle
        Positioned(
          top: 5,
          right: 5,
          child: GestureDetector(
            onTap: () {
              watchlistProvider.toggleWatchlist(content);
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
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.65),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isBookmarked ? Icons.bookmark : Icons.bookmark_border,
                color: isBookmarked ? AppColors.brand : Colors.white,
                size: 14,
              ),
            ),
          ),
        ),

        // Top left: Media type badge (Hotstar / MovieBuzz style)
        Positioned(
          top: 5,
          left: 5,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.brand.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(3),
            ),
            child: Text(
              content.isSeries ? 'SERIES' : 'MOVIE',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 8,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.4,
              ),
            ),
          ),
        ),

        // Bottom gradient with rating and language
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Color(0xCC09090B), Color(0xF009090B)],
              ),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(8),
                bottomRight: Radius.circular(8),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (showRating && content.rating > 0)
                  Row(
                    children: [
                      const Icon(Icons.star_rounded, color: AppColors.gold, size: 13),
                      const SizedBox(width: 2),
                      Text(
                        content.rating.toStringAsFixed(1),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  )
                else
                  const SizedBox.shrink(),
                // Language indicator (JioHotstar signature: हिन्दी, English)
                Text(
                  content.languages.isNotEmpty ? content.languages.first : 'Hindi',
                  style: const TextStyle(
                    color: Color(0xFFCCCCCC),
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ContentDetailScreen(content: content),
          ),
        );
      },
      child: Container(
        width: isGrid ? null : width,
        margin: EdgeInsets.only(right: isGrid ? 0 : 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // If in Grid, wrap in Expanded so it flexes dynamically with 0 overflow!
            if (isGrid)
              Expanded(child: posterStack)
            else
              SizedBox(width: width, height: height, child: posterStack),

            const SizedBox(height: 5),

            // Title
            Text(
              content.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),

            // Year and Genre
            const SizedBox(height: 1),
            Row(
              children: [
                if (content.releaseYear > 0)
                  Text(
                    '${content.releaseYear}',
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10,
                    ),
                  ),
                if (content.releaseYear > 0 && content.genres.isNotEmpty)
                  const Text(' • ', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                if (content.genres.isNotEmpty)
                  Expanded(
                    child: Text(
                      content.genres.first,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 10,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
