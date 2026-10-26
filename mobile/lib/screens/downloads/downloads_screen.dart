import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../constants/app_colors.dart';
import '../../models/content.dart';
import '../../models/offline_download_item.dart';
import '../../services/offline_storage_service.dart';
import '../../services/download_service.dart';
import '../player/video_player_screen.dart';

class DownloadsScreen extends StatefulWidget {
  const DownloadsScreen({super.key});

  @override
  State<DownloadsScreen> createState() => _DownloadsScreenState();
}

class _DownloadsScreenState extends State<DownloadsScreen> {
  List<OfflineDownloadItem> _downloads = [];
  bool _isLoading = true;
  int _totalBytes = 0;
  String _selectedFilter = 'All'; // 'All', 'Movies', 'Series'

  @override
  void initState() {
    super.initState();
    _loadDownloads();
  }

  Future<void> _loadDownloads() async {
    setState(() => _isLoading = true);
    final items = await OfflineStorageService.getDownloads();
    final bytes = await OfflineStorageService.getTotalStorageUsedBytes();
    if (mounted) {
      setState(() {
        _downloads = items;
        _totalBytes = bytes;
        _isLoading = false;
      });
    }
  }

  List<OfflineDownloadItem> get _filteredDownloads {
    if (_selectedFilter == 'Movies') {
      return _downloads.where((d) => !d.isSeries).toList();
    } else if (_selectedFilter == 'Series') {
      return _downloads.where((d) => d.isSeries).toList();
    }
    return _downloads;
  }

  int get _moviesCount => _downloads.where((d) => !d.isSeries).length;
  int get _seriesCount => _downloads.where((d) => d.isSeries).length;

  String _formatBytes(int bytes) {
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    } else {
      return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
    }
  }

  void _playOffline(OfflineDownloadItem item) {
    final mockContent = Content(
      id: item.contentId,
      title: item.title,
      slug: item.title.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '-'),
      type: item.isSeries ? 'series' : 'movie',
      description: 'Downloaded offline media: ${item.title}',
      posterUrl: item.posterUrl,
      backdropUrl: item.posterUrl,
      genres: ['Offline'],
      languages: ['English', 'Hindi'],
      cast: const [],
      rating: 9.0,
      popularity: 100,
      featured: false,
      status: 'released',
      releaseYear: 2026,
    );

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => VideoPlayerScreen(
          content: mockContent,
          offlineFilePath: item.localFilePath,
        ),
      ),
    );
  }

  Future<void> _confirmDelete(OfflineDownloadItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.darkCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.darkBorder),
        ),
        title: const Text('Delete Downloaded Title?', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: Text(
          'Remove "${item.displayTitle}" from local device cache? (${item.formattedSize})',
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.brand),
            child: const Text('Delete', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await OfflineStorageService.deleteDownload(item.id);
      _loadDownloads();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Removed "${item.displayTitle}" from local cache'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
  }

  Widget _buildPosterThumbnail(OfflineDownloadItem item) {
    return GestureDetector(
      onTap: () => _playOffline(item),
      child: Stack(
        alignment: Alignment.center,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Container(
              width: 72,
              height: 96,
              color: const Color(0xFF1C1C28),
              child: item.posterUrl.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: item.posterUrl,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(
                        color: const Color(0xFF1E1E2C),
                        child: const Center(
                          child: Icon(Icons.movie_rounded, color: AppColors.textMuted, size: 24),
                        ),
                      ),
                      errorWidget: (context, url, error) => Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AppColors.brand.withValues(alpha: 0.3),
                              const Color(0xFF14141E),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Center(
                          child: Icon(
                            item.isSeries ? Icons.tv_rounded : Icons.movie_filter_rounded,
                            color: Colors.white70,
                            size: 28,
                          ),
                        ),
                      ),
                    )
                  : Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.brand.withValues(alpha: 0.3),
                            const Color(0xFF14141E),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Center(
                        child: Icon(
                          item.isSeries ? Icons.tv_rounded : Icons.movie_filter_rounded,
                          color: Colors.white70,
                          size: 28,
                        ),
                      ),
                    ),
            ),
          ),
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.7),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white24, width: 1),
            ),
            child: const Icon(
              Icons.play_arrow_rounded,
              color: Colors.white,
              size: 20,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final downloadService = Provider.of<DownloadService>(context);
    final activeIds = downloadService.activeDownloadIds;
    final filtered = _filteredDownloads;

    return Scaffold(
      backgroundColor: AppColors.darkBase,
      appBar: AppBar(
        backgroundColor: AppColors.darkBase,
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.download_for_offline_rounded, color: AppColors.brand, size: 22),
            SizedBox(width: 8),
            Text(
              'Downloads',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary),
            onPressed: _loadDownloads,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.brand))
          : RefreshIndicator(
              color: AppColors.brand,
              backgroundColor: AppColors.darkCard,
              onRefresh: _loadDownloads,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  // Storage & Offline Status Banner
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.brand.withValues(alpha: 0.16),
                          AppColors.darkCard,
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.brand.withValues(alpha: 0.35)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.brand.withValues(alpha: 0.22),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.offline_pin_rounded, color: AppColors.brand, size: 28),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${_downloads.length} ${_downloads.length == 1 ? 'Title' : 'Titles'} Available Offline',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '${_formatBytes(_totalBytes)} stored • 100% playable without internet',
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Category Filter Pills: All, Movies, Series
                  SizedBox(
                    height: 36,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      physics: const BouncingScrollPhysics(),
                      children: [
                        _buildFilterPill('All', _downloads.length),
                        const SizedBox(width: 8),
                        _buildFilterPill('Movies', _moviesCount),
                        const SizedBox(width: 8),
                        _buildFilterPill('Series', _seriesCount),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Active Downloads Section (if any downloading right now)
                  if (activeIds.isNotEmpty) ...[
                    const Row(
                      children: [
                        SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brand),
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Downloading Now',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ...activeIds.map((id) {
                      final progress = downloadService.getProgress(id);
                      final status = downloadService.getStatus(id);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.darkCard,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.brand.withValues(alpha: 0.4)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    status,
                                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.close, color: AppColors.textSecondary, size: 18),
                                  onPressed: () => downloadService.cancelDownload(id),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: progress > 0 ? progress : null,
                                backgroundColor: AppColors.darkSurface,
                                color: AppColors.brand,
                                minHeight: 6,
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 10),
                  ],

                  // Downloaded Titles Section or Empty State
                  if (filtered.isEmpty && activeIds.isEmpty) ...[
                    const SizedBox(height: 48),
                    Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 84,
                            height: 84,
                            decoration: BoxDecoration(
                              color: AppColors.darkCard,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.darkBorder, width: 1.5),
                            ),
                            child: const Icon(
                              Icons.cloud_off_rounded,
                              size: 42,
                              color: AppColors.textMuted,
                            ),
                          ),
                          const SizedBox(height: 18),
                          const Text(
                            'No Downloaded Content',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 32),
                            child: Text(
                              _selectedFilter == 'All'
                                  ? 'You do not have any downloaded movies or series. Download titles while online to watch them anywhere without any network connection.'
                                  : (_selectedFilter == 'Movies'
                                      ? 'No downloaded movies found in offline storage.'
                                      : 'No downloaded series episodes found in offline storage.'),
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 13,
                                height: 1.45,
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
                          ElevatedButton.icon(
                            onPressed: () => Navigator.of(context).pop(),
                            icon: const Icon(Icons.home_rounded, size: 18, color: Colors.white),
                            label: const Text(
                              'Return to Home',
                              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.brand,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Ready to Watch Offline (${filtered.length})',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const Row(
                          children: [
                            Icon(Icons.wifi_off_rounded, color: Colors.greenAccent, size: 14),
                            SizedBox(width: 4),
                            Text(
                              'Zero Data Playback',
                              style: TextStyle(
                                color: Colors.greenAccent,
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ...filtered.map((item) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.darkCard,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.darkBorder),
                        ),
                        child: Row(
                          children: [
                            // Poster / Thumbnail with Play Overlay
                            _buildPosterThumbnail(item),

                            const SizedBox(width: 12),

                            // Details
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Category Tag: Movie vs Series
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: item.isSeries
                                          ? Colors.indigo.withValues(alpha: 0.25)
                                          : AppColors.brand.withValues(alpha: 0.25),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      item.isSeries ? 'SERIES' : 'MOVIE',
                                      style: TextStyle(
                                        color: item.isSeries ? const Color(0xFF818CF8) : AppColors.brand,
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 4),

                                  Text(
                                    item.displayTitle,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      height: 1.25,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 5),
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF242436),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          item.quality,
                                          style: const TextStyle(
                                            color: Colors.white70,
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        item.formattedSize,
                                        style: const TextStyle(
                                          color: AppColors.textSecondary,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  GestureDetector(
                                    onTap: () => _playOffline(item),
                                    child: const Row(
                                      children: [
                                        Icon(Icons.play_circle_fill, color: Colors.greenAccent, size: 16),
                                        SizedBox(width: 4),
                                        Text(
                                          'Play Offline',
                                          style: TextStyle(
                                            color: Colors.greenAccent,
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Delete button
                            IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 22),
                              onPressed: () => _confirmDelete(item),
                              tooltip: 'Delete offline file',
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildFilterPill(String title, int count) {
    final isSelected = _selectedFilter == title;
    return GestureDetector(
      onTap: () => setState(() => _selectedFilter = title),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
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
            '$title ($count)',
            style: TextStyle(
              color: isSelected ? Colors.white : AppColors.textSecondary,
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}
