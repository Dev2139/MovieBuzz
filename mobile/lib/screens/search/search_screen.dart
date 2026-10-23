import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../constants/app_colors.dart';
import '../../models/content.dart';
import '../../services/api_service.dart';
import '../../widgets/content_card.dart';
import '../../widgets/shimmer_loading.dart';
import '../player/video_player_screen.dart';
import '../detail/content_detail_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ApiService _api = ApiService();

  List<Content> _movieResults = [];
  List<Content> _seriesResults = [];
  List<Content> _topSearches = [];
  bool _isLoading = false;
  bool _isLoadingTop = true;
  String _filterType = 'all'; // 'all', 'movie', 'series'
  Timer? _debounceTimer;

  final List<String> _popularSuggestions = [
    'Action',
    'Sci-Fi',
    'Drama',
    'Comedy',
    'Thriller',
    'Anime',
    'Horror',
  ];

  @override
  void initState() {
    super.initState();
    _loadTopSearches();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounceTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadTopSearches() async {
    try {
      final list = await _api.getMovies(limit: 15, sort: 'popularity');
      if (mounted) {
        setState(() {
          _topSearches = list;
          _isLoadingTop = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingTop = false);
    }
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    if (query.trim().isEmpty) {
      setState(() {
        _movieResults = [];
        _seriesResults = [];
        _isLoading = false;
      });
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 350), () {
      _executeSearch(query.trim());
    });
  }

  Future<void> _executeSearch(String query) async {
    setState(() => _isLoading = true);
    try {
      final results = await _api.search(query);
      setState(() {
        _movieResults = results['movies'] as List<Content>;
        _seriesResults = results['series'] as List<Content>;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  List<Content> get _filteredResults {
    if (_filterType == 'movie') return _movieResults;
    if (_filterType == 'series') return _seriesResults;
    return [..._movieResults, ..._seriesResults];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBase,
      appBar: AppBar(
        titleSpacing: 0,
        backgroundColor: Colors.black.withValues(alpha: 0.9),
        title: Padding(
          padding: const EdgeInsets.only(right: 16.0),
          child: Container(
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.darkCard,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.darkBorder),
            ),
            child: TextField(
              controller: _searchController,
              autofocus: false,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Search movies, TV shows, genres...',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary, size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18, color: AppColors.textSecondary),
                        onPressed: () {
                          _searchController.clear();
                          _onSearchChanged('');
                        },
                      )
                    : null,
              ),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          // Filter Tabs if active search
          if (_movieResults.isNotEmpty || _seriesResults.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  _buildFilterChip('All (${_movieResults.length + _seriesResults.length})', 'all'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Movies (${_movieResults.length})', 'movie'),
                  const SizedBox(width: 8),
                  _buildFilterChip('Series (${_seriesResults.length})', 'series'),
                ],
              ),
            ),

          Expanded(
            child: _isLoading
                ? GridView.builder(
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
                : _searchController.text.trim().isEmpty
                    ? _buildNetflixTopSearchesView()
                    : _filteredResults.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.search_off_rounded, size: 60, color: AppColors.textMuted),
                                const SizedBox(height: 12),
                                Text(
                                  'No results for "${_searchController.text}"',
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 15,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                const Text(
                                  'Try searching with another actor, title or genre',
                                  style: TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          )
                        : GridView.builder(
                            padding: const EdgeInsets.all(16),
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 3,
                              childAspectRatio: 0.58,
                              crossAxisSpacing: 10,
                              mainAxisSpacing: 14,
                            ),
                            itemCount: _filteredResults.length,
                            itemBuilder: (context, index) {
                              return ContentCard(
                                content: _filteredResults[index],
                                isGrid: true,
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _filterType == value;
    return GestureDetector(
      onTap: () => setState(() => _filterType = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.brand : AppColors.darkCard,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.brand : AppColors.darkBorder,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : AppColors.textSecondary,
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  /// Netflix-style "Top Searches" vertical feed with thumbnail, title, and play button
  Widget _buildNetflixTopSearchesView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.only(top: 14, bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Genre Pills
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _popularSuggestions.map((tag) {
                return ActionChip(
                  label: Text(tag),
                  backgroundColor: AppColors.darkCard,
                  side: const BorderSide(color: AppColors.darkBorder, width: 0.6),
                  labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  onPressed: () {
                    _searchController.text = tag;
                    _executeSearch(tag);
                  },
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 20),

          // Header
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Top Searches',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.3,
              ),
            ),
          ),

          const SizedBox(height: 12),

          if (_isLoadingTop)
            Column(
              children: List.generate(
                5,
                (_) => const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: ShimmerBox(width: double.infinity, height: 75),
                ),
              ),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _topSearches.length,
              itemBuilder: (context, index) {
                final item = _topSearches[index];
                final image = item.backdropUrl.isNotEmpty ? item.backdropUrl : item.posterUrl;

                return GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ContentDetailScreen(content: item),
                      ),
                    );
                  },
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.darkCard,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      children: [
                        // Thumbnail
                        ClipRRect(
                          borderRadius: const BorderRadius.horizontal(left: Radius.circular(6)),
                          child: SizedBox(
                            width: 130,
                            height: 75,
                            child: image.isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: image,
                                    fit: BoxFit.cover,
                                  )
                                : Container(color: Colors.black26),
                          ),
                        ),
                        const SizedBox(width: 14),

                        // Title
                        Expanded(
                          child: Text(
                            item.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        ),

                        // Netflix Play button circle
                        IconButton(
                          icon: const Icon(Icons.play_circle_outline_rounded, color: Colors.white, size: 28),
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => VideoPlayerScreen(content: item),
                              ),
                            );
                          },
                        ),
                        const SizedBox(width: 4),
                      ],
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
