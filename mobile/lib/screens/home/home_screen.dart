import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/content_provider.dart';
import '../../widgets/shimmer_loading.dart';
import 'widgets/hero_banner.dart';
import 'widgets/top_10_row.dart';
import 'widgets/content_row.dart';
import 'widgets/continue_watching_row.dart';
import '../movies/movies_screen.dart';
import '../series/series_screen.dart';
import '../requests/requests_screen.dart';
import '../profile/profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _selectedCategory = 'All';
  final List<String> _categoryFilters = [
    'All',
    'Movies',
    'Series',
    'Action',
    'Sci-Fi',
    'Thriller',
    'Drama',
    'Comedy',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ContentProvider>(context, listen: false).loadHomeFeed();
    });
  }

  @override
  Widget build(BuildContext context) {
    final contentProvider = Provider.of<ContentProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.user;

    return Scaffold(
      backgroundColor: AppColors.darkBase,
      body: SafeArea(
        top: true,
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.brand,
          backgroundColor: AppColors.darkCard,
          onRefresh: () async {
            await contentProvider.loadHomeFeed();
          },
          child: CustomScrollView(
            slivers: [
              // Distinctive MovieBuzz App Bar
              SliverAppBar(
                floating: true,
                pinned: false,
                backgroundColor: AppColors.darkBase.withValues(alpha: 0.95),
                elevation: 0,
                titleSpacing: 16,
                title: Row(
                  children: [
                    // MovieBuzz Badge Icon
                    Container(
                      padding: const EdgeInsets.all(6),
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        gradient: AppColors.brandGradient,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.brand.withValues(alpha: 0.4),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.local_movies_rounded,
                        color: Colors.white,
                        size: 16,
                      ),
                    ),
                    RichText(
                      text: const TextSpan(
                        children: [
                          TextSpan(
                            text: 'MOVIE',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                            ),
                          ),
                          TextSpan(
                            text: 'BUZZ',
                            style: TextStyle(
                              color: AppColors.brand,
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                actions: [
                  // CineCoins Badge (if user has coins or logged in)
                  if (user != null)
                    Container(
                      margin: const EdgeInsets.symmetric(vertical: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1C1917),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.gold.withValues(alpha: 0.5)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.monetization_on, color: AppColors.gold, size: 14),
                          const SizedBox(width: 4),
                          Text(
                            '${user.cineCoins}',
                            style: const TextStyle(
                              color: AppColors.gold,
                              fontWeight: FontWeight.w800,
                              fontSize: 11.5,
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Community Voting / Requests
                  IconButton(
                    icon: const Icon(Icons.how_to_vote_outlined, color: Colors.white, size: 21),
                    tooltip: 'Requests',
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const RequestsScreen()),
                      );
                    },
                  ),

                  // User Avatar
                  GestureDetector(
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const ProfileScreen()),
                      );
                    },
                    child: Padding(
                      padding: const EdgeInsets.only(right: 16, left: 4),
                      child: CircleAvatar(
                        radius: 15,
                        backgroundColor: AppColors.darkCardElevated,
                        child: Text(
                          user != null && user.name.isNotEmpty
                              ? user.name[0].toUpperCase()
                              : 'U',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              // Category / Mood Pills Filter Bar
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 38,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    itemCount: _categoryFilters.length,
                    itemBuilder: (context, index) {
                      final category = _categoryFilters[index];
                      final isSelected = _selectedCategory == category;

                      return GestureDetector(
                        onTap: () {
                          setState(() => _selectedCategory = category);
                        },
                        child: Container(
                          margin: const EdgeInsets.only(right: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                          decoration: BoxDecoration(
                            color: isSelected ? AppColors.brand : const Color(0xFF14141E),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isSelected ? AppColors.brand : const Color(0xFF242436),
                              width: 0.8,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              category,
                              style: TextStyle(
                                color: isSelected ? Colors.white : AppColors.textSecondary,
                                fontSize: 12,
                                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 12)),

              // Content Loading or Error
              if (contentProvider.isLoading && contentProvider.trendingMovies.isEmpty)
                SliverToBoxAdapter(
                  child: Column(
                    children: [
                      const ShimmerBox(width: double.infinity, height: 440, borderRadius: 20),
                      const SizedBox(height: 24),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Row(
                          children: List.generate(
                            3,
                            (index) => const ContentCardSkeleton(),
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else if (contentProvider.error != null && contentProvider.trendingMovies.isEmpty)
                SliverFillRemaining(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.cloud_off_rounded, size: 54, color: AppColors.textMuted),
                          const SizedBox(height: 16),
                          const Text(
                            'Unable to connect to MovieBuzz',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            authProvider.currentBaseUrl,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                          ),
                          const SizedBox(height: 20),
                          ElevatedButton.icon(
                            onPressed: () => contentProvider.loadHomeFeed(),
                            icon: const Icon(Icons.refresh),
                            label: const Text('Try Again'),
                            style: ElevatedButton.styleFrom(backgroundColor: AppColors.brand),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                SliverList(
                  delegate: SliverChildListDelegate([
                    // 1. Cinematic Hero Showcase Carousel
                    HeroBanner(items: contentProvider.featured),

                    const SizedBox(height: 18),

                    // 2. Continue Watching (if history exists)
                    if (contentProvider.continueWatching.isNotEmpty)
                      ContinueWatchingRow(
                        items: contentProvider.continueWatching,
                        onRefresh: () => contentProvider.refreshContinueWatching(),
                      ),

                    const SizedBox(height: 14),

                    // 3. Top 10 on MovieBuzz
                    if (contentProvider.trendingMovies.isNotEmpty)
                      Top10Row(
                        title: 'Top 10 on MovieBuzz',
                        items: contentProvider.trendingMovies,
                      ),

                    const SizedBox(height: 18),

                    // 4. Trending Blockbusters Row
                    ContentRow(
                      title: _selectedCategory != 'All' ? '$_selectedCategory Titles' : 'Trending Blockbusters',
                      items: _selectedCategory != 'All'
                          ? (_selectedCategory == 'Movies'
                              ? contentProvider.trendingMovies
                              : (_selectedCategory == 'Series'
                                  ? contentProvider.popularSeries
                                  : contentProvider.trendingMovies
                                      .where((m) => m.genres.contains(_selectedCategory))
                                      .toList()))
                          : contentProvider.trendingMovies,
                      onSeeAll: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => MoviesScreen(
                              initialGenre: _selectedCategory != 'All' &&
                                      _selectedCategory != 'Movies' &&
                                      _selectedCategory != 'Series'
                                  ? _selectedCategory
                                  : null,
                            ),
                          ),
                        );
                      },
                    ),

                    const SizedBox(height: 18),

                    // 5. Popular Web Series
                    ContentRow(
                      title: 'Popular Web Series',
                      items: contentProvider.popularSeries,
                      onSeeAll: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const SeriesScreen()),
                        );
                      },
                    ),

                    const SizedBox(height: 18),

                    // 6. Action & Adrenaline Row
                    if (contentProvider.trendingMovies.isNotEmpty)
                      ContentRow(
                        title: 'Action & Adrenaline',
                        items: contentProvider.trendingMovies
                            .where((m) =>
                                m.genres.any((g) => g.toLowerCase().contains('action') || g.toLowerCase().contains('adventure')))
                            .toList(),
                      ),

                    const SizedBox(height: 18),

                    // 7. Critically Acclaimed & Top Rated
                    if (contentProvider.trendingMovies.isNotEmpty)
                      ContentRow(
                        title: 'Critically Acclaimed',
                        items: (contentProvider.trendingMovies.toList()
                          ..sort((a, b) => b.rating.compareTo(a.rating))),
                      ),

                    const SizedBox(height: 24),
                  ]),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
