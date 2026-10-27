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
import '../../services/api_service.dart';
import '../update/app_update_screen.dart';
import '../../constants/api_constants.dart';
import '../downloads/downloads_screen.dart';
import '../../models/content.dart';
import '../../widgets/content_card.dart';
import '../../services/network_monitor_service.dart';

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
      _checkForAppUpdate();
    });
  }

  Future<void> _checkForAppUpdate() async {
    try {
      final update = await ApiService().getLatestAppUpdate();
      if (update != null && mounted) {
        final serverVersionCode = update['versionCode'] is int
            ? update['versionCode'] as int
            : int.tryParse(update['versionCode']?.toString() ?? '0') ?? 0;
        final serverVersion = update['version'] as String? ?? '';

        // Strict Check: ONLY notify user if they are on an OLDER version.
        // If they already have the latest version (e.g. 25 / 2.5.0), do NOT notify!
        final bool isNewer = serverVersionCode > 0
            ? serverVersionCode > ApiConstants.appVersionCode
            : (serverVersion.isNotEmpty && serverVersion != ApiConstants.appVersion);

        if (isNewer) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => AppUpdateScreen(updateInfo: update),
            ),
          );
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final contentProvider = Provider.of<ContentProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context);
    final networkMonitor = Provider.of<NetworkMonitorService>(context);
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
            await networkMonitor.checkConnectivity();
            await contentProvider.loadHomeFeed();
          },
          child: CustomScrollView(
            physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
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

                  // Offline Downloads
                  IconButton(
                    icon: const Icon(Icons.download_for_offline_rounded, color: Colors.white, size: 22),
                    tooltip: 'Offline Downloads',
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const DownloadsScreen()),
                      );
                    },
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
                    physics: const BouncingScrollPhysics(),
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
              else if ((contentProvider.error != null || networkMonitor.isOffline) && contentProvider.trendingMovies.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 88,
                            height: 88,
                            decoration: BoxDecoration(
                              color: AppColors.brand.withValues(alpha: 0.12),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.brand.withValues(alpha: 0.35),
                                width: 1.5,
                              ),
                            ),
                            child: const Icon(
                              Icons.wifi_off_rounded,
                              size: 44,
                              color: AppColors.brand,
                            ),
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            'Network Offline or Slow',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: 0.2,
                            ),
                          ),
                          const SizedBox(height: 10),
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 16),
                            child: Text(
                              'Network connection is currently unavailable or too slow to stream. You can still watch all your downloaded movies & series offline anytime!',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                                height: 1.45,
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          // Primary Redirect Button to Downloads
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 320),
                            child: SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton.icon(
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => const DownloadsScreen()),
                                );
                              },
                              icon: const Icon(Icons.download_for_offline_rounded, color: Colors.white, size: 21),
                              label: const Text(
                                'Go to Downloads (Watch Offline)',
                                style: TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.brand,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                elevation: 6,
                                shadowColor: AppColors.brand.withValues(alpha: 0.5),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                          // Secondary Retry Button
                          TextButton.icon(
                            onPressed: () async {
                              await networkMonitor.checkConnectivity();
                              contentProvider.loadHomeFeed();
                            },
                            icon: const Icon(Icons.refresh_rounded, size: 18, color: AppColors.textSecondary),
                            label: const Text(
                              'Retry Connection',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                SliverList(
                  delegate: SliverChildListDelegate([
                    // Network Warning Banner if network is slow or offline while content is cached
                    if (networkMonitor.isProblematic)
                      Container(
                        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: networkMonitor.isOffline
                                ? [
                                    const Color(0xFFEF4444).withValues(alpha: 0.22),
                                    const Color(0xFF1F1113),
                                  ]
                                : [
                                    const Color(0xFFF59E0B).withValues(alpha: 0.22),
                                    const Color(0xFF1F1A11),
                                  ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: networkMonitor.isOffline
                                ? const Color(0xFFEF4444).withValues(alpha: 0.5)
                                : const Color(0xFFF59E0B).withValues(alpha: 0.5),
                            width: 1.2,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: (networkMonitor.isOffline ? Colors.redAccent : Colors.amber)
                                    .withValues(alpha: 0.2),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                networkMonitor.isOffline ? Icons.wifi_off_rounded : Icons.speed_rounded,
                                color: networkMonitor.isOffline ? const Color(0xFFF87171) : const Color(0xFFFBBF24),
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    networkMonitor.isOffline
                                        ? 'No Internet Connection'
                                        : 'Slow Network Connection',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    networkMonitor.isOffline
                                        ? 'Watch your downloaded titles without buffering'
                                        : 'Streaming may lag. Switch to offline downloads',
                                    style: const TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 11.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            ElevatedButton.icon(
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => const DownloadsScreen()),
                                );
                              },
                              icon: const Icon(Icons.download_for_offline_rounded, size: 16, color: Colors.white),
                              label: const Text(
                                'Downloads',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.brand,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ],
                        ),
                      ),

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

                    const SizedBox(height: 22),

                    // 8. All Movies & Series Combined Grid
                    Builder(
                      builder: (context) {
                        final seenIds = <String>{};
                        final combinedList = <Content>[];

                        for (final item in [
                          ...contentProvider.trendingMovies,
                          ...contentProvider.popularSeries,
                          ...contentProvider.featured,
                        ]) {
                          if (seenIds.add(item.id)) {
                            if (_selectedCategory == 'All') {
                              combinedList.add(item);
                            } else if (_selectedCategory == 'Movies' && item.isMovie) {
                              combinedList.add(item);
                            } else if (_selectedCategory == 'Series' && item.isSeries) {
                              combinedList.add(item);
                            } else if (item.genres.any((g) => g.toLowerCase() == _selectedCategory.toLowerCase())) {
                              combinedList.add(item);
                            }
                          }
                        }

                        if (combinedList.isEmpty) {
                          return const SizedBox.shrink();
                        }

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: Row(
                                children: [
                                  Container(
                                    width: 4,
                                    height: 18,
                                    decoration: BoxDecoration(
                                      color: AppColors.brand,
                                      borderRadius: BorderRadius.circular(2),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Expanded(
                                    child: Text(
                                      'All Movies & Series',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: -0.3,
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppColors.darkCard,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: AppColors.darkBorder, width: 0.5),
                                    ),
                                    child: Text(
                                      '${combinedList.length} Titles',
                                      style: const TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 14),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: GridView.builder(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 3,
                                  childAspectRatio: 0.58,
                                  crossAxisSpacing: 10,
                                  mainAxisSpacing: 14,
                                ),
                                itemCount: combinedList.length,
                                itemBuilder: (context, index) {
                                  return ContentCard(
                                    content: combinedList[index],
                                    isGrid: true,
                                  );
                                },
                              ),
                            ),
                            const SizedBox(height: 32),
                          ],
                        );
                      },
                    ),
                  ]),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
