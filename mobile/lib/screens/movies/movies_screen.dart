import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../constants/app_colors.dart';
import '../../models/content.dart';
import '../../services/api_service.dart';
import '../../widgets/content_card.dart';
import '../../widgets/shimmer_loading.dart';
import '../detail/content_detail_screen.dart';
import '../player/video_player_screen.dart';

class MoviesScreen extends StatefulWidget {
  final String? initialGenre;

  const MoviesScreen({super.key, this.initialGenre});

  @override
  State<MoviesScreen> createState() => _MoviesScreenState();
}

class _MoviesScreenState extends State<MoviesScreen> {
  final ApiService _api = ApiService();
  List<Content> _movies = [];
  List<String> _genres = [];
  String? _selectedGenre;
  String _selectedSort = 'popularity';
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _selectedGenre = widget.initialGenre;
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _api.getMovies(
          genre: _selectedGenre,
          sort: _selectedSort,
          limit: 30,
        ),
        _api.getGenres(),
      ]);

      setState(() {
        _movies = results[0] as List<Content>;
        _genres = results[1] as List<String>;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final billboard = _movies.isNotEmpty ? _movies.first : null;
    final gridItems = _movies.length > 1 ? _movies.sublist(1) : _movies;

    return Scaffold(
      backgroundColor: AppColors.darkBase,
      appBar: AppBar(
        title: const Text('Movies', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
        backgroundColor: Colors.black.withValues(alpha: 0.9),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.sort_rounded),
            tooltip: 'Sort By',
            color: AppColors.darkCard,
            onSelected: (val) {
              setState(() => _selectedSort = val);
              _loadData();
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'popularity', child: Text('Most Popular', style: TextStyle(color: Colors.white))),
              const PopupMenuItem(value: 'rating', child: Text('Top Rated', style: TextStyle(color: Colors.white))),
              const PopupMenuItem(value: 'latest', child: Text('Latest Released', style: TextStyle(color: Colors.white))),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Genre filters
          if (_genres.isNotEmpty)
            SizedBox(
              height: 44,
              child: ListView.builder(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                scrollDirection: Axis.horizontal,
                itemCount: _genres.length + 1,
                itemBuilder: (context, index) {
                  if (index == 0) {
                    final isSelected = _selectedGenre == null;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: const Text('All Movies'),
                        selected: isSelected,
                        onSelected: (_) {
                          setState(() => _selectedGenre = null);
                          _loadData();
                        },
                        selectedColor: AppColors.brand,
                        backgroundColor: AppColors.darkCard,
                        labelStyle: TextStyle(
                          color: isSelected ? Colors.white : AppColors.textSecondary,
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    );
                  }
                  final genre = _genres[index - 1];
                  final isSelected = _selectedGenre == genre;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(genre),
                      selected: isSelected,
                      onSelected: (_) {
                        setState(() => _selectedGenre = isSelected ? null : genre);
                        _loadData();
                      },
                      selectedColor: AppColors.brand,
                      backgroundColor: AppColors.darkCard,
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.white : AppColors.textSecondary,
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  );
                },
              ),
            ),

          // Content Grid with Billboard Header
          Expanded(
            child: _isLoading
                ? GridView.builder(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      childAspectRatio: 0.58,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 16,
                    ),
                    itemCount: 9,
                    itemBuilder: (_, __) => const ShimmerBox(width: 100, height: 160),
                  )
                : _movies.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.movie_filter_outlined, size: 56, color: AppColors.textMuted),
                            const SizedBox(height: 12),
                            const Text('No movies found for this filter', style: TextStyle(color: AppColors.textSecondary)),
                            const SizedBox(height: 16),
                            ElevatedButton(
                              onPressed: () {
                                setState(() {
                                  _selectedGenre = null;
                                  _selectedSort = 'popularity';
                                });
                                _loadData();
                              },
                              child: const Text('Reset Filters'),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.brand,
                        onRefresh: _loadData,
                        child: CustomScrollView(
                          physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                          slivers: [
                            // Netflix Billboard Header for Featured Movie
                            if (billboard != null && _selectedGenre == null)
                              SliverToBoxAdapter(
                                child: GestureDetector(
                                  onTap: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(builder: (_) => ContentDetailScreen(content: billboard)),
                                    );
                                  },
                                  child: Container(
                                    height: 190,
                                    margin: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: AppColors.darkBorder),
                                    ),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: Stack(
                                        fit: StackFit.expand,
                                        children: [
                                          billboard.backdropUrl.isNotEmpty
                                              ? CachedNetworkImage(
                                                  imageUrl: billboard.backdropUrl,
                                                  fit: BoxFit.cover,
                                                  memCacheWidth: 900,
                                                  maxWidthDiskCache: 1400,
                                                  fadeInDuration: const Duration(milliseconds: 250),
                                                )
                                              : Container(color: AppColors.darkCard),
                                          Container(
                                            decoration: const BoxDecoration(
                                              gradient: LinearGradient(
                                                begin: Alignment.topCenter,
                                                end: Alignment.bottomCenter,
                                                colors: [Colors.transparent, Color(0xCC09090B), Color(0xFF09090B)],
                                              ),
                                            ),
                                          ),
                                          Positioned(
                                            left: 14,
                                            bottom: 14,
                                            right: 14,
                                            child: Row(
                                              children: [
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      Text(
                                                        billboard.title,
                                                        maxLines: 1,
                                                        overflow: TextOverflow.ellipsis,
                                                        style: const TextStyle(
                                                          color: Colors.white,
                                                          fontSize: 18,
                                                          fontWeight: FontWeight.bold,
                                                        ),
                                                      ),
                                                      const SizedBox(height: 2),
                                                      Text(
                                                        billboard.genres.join(' • '),
                                                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                ElevatedButton.icon(
                                                  onPressed: () {
                                                    Navigator.of(context).push(
                                                      MaterialPageRoute(builder: (_) => VideoPlayerScreen(content: billboard)),
                                                    );
                                                  },
                                                  icon: const Icon(Icons.play_arrow_rounded, color: Colors.black, size: 20),
                                                  label: const Text('Play', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                                                  style: ElevatedButton.styleFrom(
                                                    backgroundColor: Colors.white,
                                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),

                            // Grid of Movies
                            SliverPadding(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              sliver: SliverGrid(
                                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 3,
                                  childAspectRatio: 0.58,
                                  crossAxisSpacing: 10,
                                  mainAxisSpacing: 14,
                                ),
                                delegate: SliverChildBuilderDelegate(
                                  (context, index) {
                                    return ContentCard(
                                      content: gridItems[index],
                                      isGrid: true,
                                    );
                                  },
                                  childCount: gridItems.length,
                                ),
                              ),
                            ),
                            const SliverToBoxAdapter(child: SizedBox(height: 24)),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
