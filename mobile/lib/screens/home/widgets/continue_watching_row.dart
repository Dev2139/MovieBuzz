import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../models/watch_history.dart';
import '../../../constants/app_colors.dart';
import '../../player/video_player_screen.dart';
import '../../../widgets/shimmer_loading.dart';

class ContinueWatchingRow extends StatelessWidget {
  final List<WatchHistoryItem> items;
  final VoidCallback onRefresh;

  const ContinueWatchingRow({
    super.key,
    required this.items,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Icon(Icons.history_rounded, color: AppColors.brand, size: 20),
              SizedBox(width: 8),
              Text(
                'Continue Watching',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 155,
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            itemBuilder: (context, index) {
              final item = items[index];
              final imageUrl = item.content.backdropUrl.isNotEmpty
                  ? item.content.backdropUrl
                  : item.content.posterUrl;

              final remainingSeconds = item.duration > 0
                  ? (item.duration - item.progress).clamp(0, item.duration)
                  : 1200;
              final remainingMinutes = (remainingSeconds / 60).round();

              final episodeLabel = item.episode != null
                  ? 'S${item.episode?.seasonNumber ?? 1} E${item.episode?.episodeNumber ?? 1}: ${item.episode?.title ?? ''}'
                  : item.content.title;

              return GestureDetector(
                onTap: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => VideoPlayerScreen(
                        content: item.content,
                        episode: item.episode,
                        initialProgress: item.progress,
                      ),
                    ),
                  );
                  onRefresh();
                },
                child: Container(
                  width: 180,
                  margin: const EdgeInsets.only(right: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Video thumbnail with rounded corners & progress bar
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Stack(
                          children: [
                            Container(
                              width: 180,
                              height: 104,
                              color: AppColors.darkCard,
                              child: imageUrl.isNotEmpty
                                  ? CachedNetworkImage(
                                      imageUrl: imageUrl,
                                      fit: BoxFit.cover,
                                      placeholder: (context, url) => const ShimmerBox(
                                        width: 180,
                                        height: 104,
                                      ),
                                      errorWidget: (context, url, error) => const Center(
                                        child: Icon(Icons.movie, color: AppColors.textMuted),
                                      ),
                                    )
                                  : const Center(
                                      child: Icon(Icons.movie, color: AppColors.textMuted),
                                    ),
                            ),

                            // Center play button with glass glow
                            Positioned.fill(
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.3),
                                ),
                                child: Center(
                                  child: Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(alpha: 0.6),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 1.2),
                                    ),
                                    child: const Icon(
                                      Icons.play_arrow_rounded,
                                      color: Colors.white,
                                      size: 22,
                                    ),
                                  ),
                                ),
                              ),
                            ),

                            // Progress bar along the bottom
                            Positioned(
                              bottom: 0,
                              left: 0,
                              right: 0,
                              child: LinearProgressIndicator(
                                value: item.percentage,
                                backgroundColor: Colors.white24,
                                valueColor: const AlwaysStoppedAnimation<Color>(AppColors.brand),
                                minHeight: 3.5,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 6),

                      // Episode label + remaining time
                      Text(
                        episodeLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        '${remainingMinutes > 0 ? remainingMinutes : 15}m remaining',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
