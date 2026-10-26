import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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

  @override
  Widget build(BuildContext context) {
    final downloadService = Provider.of<DownloadService>(context);
    final activeIds = downloadService.activeDownloadIds;

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
              'Offline Downloads',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
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
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  // Storage & Offline Status Banner
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.brand.withValues(alpha: 0.15),
                          AppColors.darkCard,
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.brand.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.brand.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.folder_special_rounded, color: AppColors.brand, size: 28),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${_downloads.length} ${_downloads.length == 1 ? 'Title' : 'Titles'} Downloaded',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '${_formatBytes(_totalBytes)} stored in mobile cache • In-app offline only',
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

                  const SizedBox(height: 18),

                  // Active Downloads Section (if any)
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

                  // Downloaded Titles Section
                  if (_downloads.isEmpty && activeIds.isEmpty) ...[
                    const SizedBox(height: 60),
                    Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              color: AppColors.darkCard,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.darkBorder),
                            ),
                            child: const Icon(
                              Icons.cloud_download_outlined,
                              size: 40,
                              color: AppColors.textMuted,
                            ),
                          ),
                          const SizedBox(height: 18),
                          const Text(
                            'No Offline Downloads Yet',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 32),
                            child: Text(
                              'Download movies & episodes to watch anywhere with zero internet, buffered in your device storage.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 13,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ] else ...[
                    const Text(
                      'Ready to Watch Offline',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ..._downloads.map((item) {
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
                            GestureDetector(
                              onTap: () => _playOffline(item),
                              child: Stack(
                                alignment: Alignment.center,
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: Container(
                                      width: 70,
                                      height: 90,
                                      color: Colors.black26,
                                      child: item.posterUrl.isNotEmpty
                                          ? Image.network(
                                              item.posterUrl,
                                              fit: BoxFit.cover,
                                              errorBuilder: (_, __, ___) => const Icon(Icons.movie, color: AppColors.textMuted),
                                            )
                                          : const Icon(Icons.movie, color: AppColors.textMuted),
                                    ),
                                  ),
                                  Container(
                                    width: 32,
                                    height: 32,
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(alpha: 0.65),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.play_arrow_rounded,
                                      color: Colors.white,
                                      size: 20,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            const SizedBox(width: 12),

                            // Details
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
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
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppColors.brand.withValues(alpha: 0.2),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          item.quality,
                                          style: const TextStyle(
                                            color: AppColors.brand,
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
}
