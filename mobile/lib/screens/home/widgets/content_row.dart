import 'package:flutter/material.dart';
import '../../../models/content.dart';
import '../../../constants/app_colors.dart';
import '../../../widgets/content_card.dart';

class ContentRow extends StatelessWidget {
  final String title;
  final List<Content> items;
  final VoidCallback? onSeeAll;
  final double cardWidth;
  final double cardHeight;

  const ContentRow({
    super.key,
    required this.title,
    required this.items,
    this.onSeeAll,
    this.cardWidth = 130,
    this.cardHeight = 195,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.3,
                ),
              ),
              if (onSeeAll != null)
                GestureDetector(
                  onTap: onSeeAll,
                  child: const Row(
                    children: [
                      Text(
                        'See All',
                        style: TextStyle(
                          color: AppColors.brand,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(width: 2),
                      Icon(Icons.chevron_right, size: 16, color: AppColors.brand),
                    ],
                  ),
                ),
            ],
          ),
        ),
        SizedBox(
          height: cardHeight + 50,
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            itemCount: items.length,
            itemBuilder: (context, index) {
              return ContentCard(
                content: items[index],
                width: cardWidth,
                height: cardHeight,
              );
            },
          ),
        ),
      ],
    );
  }
}
