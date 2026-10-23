import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../models/content.dart';
import '../../../constants/app_colors.dart';
import '../../player/video_player_screen.dart';

class Top10Row extends StatefulWidget {
  final String title;
  final List<Content> items;

  const Top10Row({
    super.key,
    this.title = 'Top 10 on MovieBuzz',
    required this.items,
  });

  @override
  State<Top10Row> createState() => _Top10RowState();
}

class _Top10RowState extends State<Top10Row> {
  String _activeFilter = 'All';
  final List<String> _filters = ['All', 'Movies', 'Series', 'Action', 'Drama'];

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();

    // Filter items according to the active category
    final filtered = widget.items.where((item) {
      if (_activeFilter == 'All') return true;
      if (_activeFilter == 'Movies') return item.isMovie;
      if (_activeFilter == 'Series') return item.isSeries;
      return item.genres.any((g) => g.toLowerCase().contains(_activeFilter.toLowerCase()));
    }).toList();

    final topItems = (filtered.isNotEmpty ? filtered : widget.items).take(10).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.brand,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'TOP 10',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                widget.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.4,
                ),
              ),
            ],
          ),
        ),

        // Quick Category Filter Chips
        SizedBox(
          height: 34,
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: _filters.length,
            itemBuilder: (context, index) {
              final filter = _filters[index];
              final isSel = _activeFilter == filter;

              return GestureDetector(
                onTap: () => setState(() => _activeFilter = filter),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSel ? AppColors.brand : const Color(0xFF161622),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isSel ? AppColors.brand : const Color(0xFF262638),
                      width: 0.8,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      filter,
                      style: TextStyle(
                        color: isSel ? Colors.white : AppColors.textSecondary,
                        fontSize: 11.5,
                        fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),

        const SizedBox(height: 12),

        // Ranked Posters with Distinctive Big Metallic Numbers
        SizedBox(
          height: 200,
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            itemCount: topItems.length,
            itemBuilder: (context, index) {
              final item = topItems[index];
              final rank = index + 1;

              return GestureDetector(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => VideoPlayerScreen(content: item),
                    ),
                  );
                },
                child: Container(
                  width: 148,
                  margin: const EdgeInsets.only(right: 12),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      // Poster with rounded corners and subtle border
                      Positioned(
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 114,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            decoration: BoxDecoration(
                              color: AppColors.darkCard,
                              border: Border.all(color: const Color(0xFF222230), width: 0.8),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: item.posterUrl.isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: item.posterUrl,
                                    fit: BoxFit.cover,
                                    memCacheWidth: 350,
                                    maxWidthDiskCache: 600,
                                    fadeInDuration: const Duration(milliseconds: 180),
                                    placeholder: (context, url) => Container(color: AppColors.darkCard),
                                    errorWidget: (context, url, error) => const Center(
                                      child: Icon(Icons.movie, color: AppColors.textMuted),
                                    ),
                                  )
                                : const Center(
                                    child: Icon(Icons.movie, color: AppColors.textMuted),
                                  ),
                          ),
                        ),
                      ),

                      // Stylized Number Badge with outline & drop shadow
                      Positioned(
                        left: -4,
                        bottom: -16,
                        child: Stack(
                          children: [
                            // Shadow stroke
                            Text(
                              '$rank',
                              style: TextStyle(
                                fontSize: 92,
                                fontWeight: FontWeight.w900,
                                height: 1,
                                letterSpacing: -6,
                                foreground: Paint()
                                  ..style = PaintingStyle.stroke
                                  ..strokeWidth = 3
                                  ..color = const Color(0xFF2E2E44),
                              ),
                            ),
                            // Gradient inner fill
                            ShaderMask(
                              shaderCallback: (bounds) => const LinearGradient(
                                colors: [Colors.white, Color(0xFF888899)],
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                              ).createShader(bounds),
                              child: Text(
                                '$rank',
                                style: const TextStyle(
                                  fontSize: 92,
                                  fontWeight: FontWeight.w900,
                                  height: 1,
                                  letterSpacing: -6,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ],
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
