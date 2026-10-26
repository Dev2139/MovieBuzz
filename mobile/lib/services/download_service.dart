import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/content.dart';
import '../models/episode.dart';
import '../models/media.dart';
import '../models/offline_download_item.dart';
import 'api_service.dart';
import 'offline_storage_service.dart';
import '../utils/media_url_resolver.dart';

class DownloadService extends ChangeNotifier {
  static final DownloadService _instance = DownloadService._internal();
  factory DownloadService() => _instance;
  DownloadService._internal();

  final Map<String, double> _progressMap = {};
  final Map<String, String> _statusMap = {};
  final Set<String> _activeDownloadIds = {};
  final Map<String, http.Client> _clients = {};

  Map<String, double> get progressMap => _progressMap;
  Map<String, String> get statusMap => _statusMap;
  Set<String> get activeDownloadIds => _activeDownloadIds;

  bool isDownloading(String id) => _activeDownloadIds.contains(id);
  double getProgress(String id) => _progressMap[id] ?? 0.0;
  String getStatus(String id) => _statusMap[id] ?? '';

  Future<void> downloadMovie({
    required Content content,
    Media? media,
    Function(String error)? onError,
    VoidCallback? onCompleted,
  }) async {
    final id = 'movie-${content.id}';
    if (_activeDownloadIds.contains(id)) return;

    _activeDownloadIds.add(id);
    _progressMap[id] = 0.01;
    _statusMap[id] = 'Resolving high-speed stream...';
    notifyListeners();

    try {
      final api = ApiService();
      String streamUrl = '';
      String quality = media?.quality ?? '1080p';

      if (media != null && media.streamUrl.isNotEmpty) {
        streamUrl = media.streamUrl;
      } else {
        // Resolve best streaming source
        try {
          final res = await api.resolveStreamingSources(
            title: content.title,
            year: content.releaseYear,
            type: 'movie',
            imdbId: content.imdbId,
            tmdbId: content.tmdbId?.toString(),
          );
          final sources = (res['sources'] as List<dynamic>?) ?? [];
          if (sources.isNotEmpty) {
            final first = sources.first;
            streamUrl = (first['rawStreamUrl'] ?? first['streamUrl'] ?? '').toString();
            quality = (first['quality'] ?? '1080p').toString();
          }
        } catch (_) {}

        if (streamUrl.isEmpty) {
          try {
            final catalog = await api.getContentBySlug(content.slug);
            final catMedia = (catalog['media'] as List<Media>?) ?? [];
            if (catMedia.isNotEmpty) {
              final m = catMedia.first;
              final dUrl = m.downloadUrl;
              streamUrl = (dUrl != null && dUrl.isNotEmpty) ? dUrl : m.streamUrl;
              quality = m.quality;
            }
          } catch (_) {}
        }
      }

      if (streamUrl.isEmpty) {
        throw Exception('No playable source found for this title');
      }

      // If stream is HLS or DASH, use backend remux endpoint so it downloads as a playable MP4
      final downloadUrl = _formatPlayableDownloadUrl(streamUrl, content.title, quality, api.baseUrl);

      final offlineDir = await OfflineStorageService.getOfflineStorageDir();
      final safeName = content.title.replaceAll(RegExp(r'[^a-zA-Z0-9_\-]'), '_');
      final localFilePath = '${offlineDir.path}/${safeName}_${content.id}.mp4';

      await _executeStreamDownload(
        id: id,
        url: downloadUrl,
        localFilePath: localFilePath,
      );

      final file = File(localFilePath);
      final fileSizeBytes = await file.length();

      final downloadItem = OfflineDownloadItem(
        id: id,
        contentId: content.id,
        title: content.title,
        isSeries: false,
        posterUrl: content.posterUrl,
        localFilePath: localFilePath,
        fileSizeBytes: fileSizeBytes,
        quality: quality,
        downloadedAt: DateTime.now(),
      );

      await OfflineStorageService.saveDownload(downloadItem);

      _statusMap[id] = 'Completed';
      _progressMap[id] = 1.0;
      _activeDownloadIds.remove(id);
      _clients.remove(id);
      notifyListeners();

      onCompleted?.call();
    } catch (e) {
      _activeDownloadIds.remove(id);
      _clients.remove(id);
      _statusMap[id] = 'Failed: ${e.toString()}';
      notifyListeners();
      onError?.call(e.toString());
    }
  }

  Future<void> downloadEpisode({
    required Content content,
    required Episode episode,
    Function(String error)? onError,
    VoidCallback? onCompleted,
  }) async {
    final id = 'series-${content.id}-s${episode.seasonNumber}-e${episode.episodeNumber}';
    if (_activeDownloadIds.contains(id)) return;

    _activeDownloadIds.add(id);
    _progressMap[id] = 0.01;
    _statusMap[id] = 'Resolving episode stream...';
    notifyListeners();

    try {
      final api = ApiService();
      String streamUrl = '';
      String quality = '1080p';

      try {
        final res = await api.resolveStreamingSources(
          title: content.title,
          year: content.releaseYear,
          type: 'series',
          season: episode.seasonNumber,
          episode: episode.episodeNumber,
          imdbId: content.imdbId,
          tmdbId: content.tmdbId?.toString(),
        );
        final sources = (res['sources'] as List<dynamic>?) ?? [];
        if (sources.isNotEmpty) {
          final first = sources.first;
          streamUrl = (first['rawStreamUrl'] ?? first['streamUrl'] ?? '').toString();
          quality = (first['quality'] ?? '1080p').toString();
        }
      } catch (_) {}

      if (streamUrl.isEmpty) {
        throw Exception('No playable source found for this episode');
      }

      final epTitle = '${content.title} S${episode.seasonNumber}E${episode.episodeNumber}';
      final downloadUrl = _formatPlayableDownloadUrl(streamUrl, epTitle, quality, api.baseUrl);

      final offlineDir = await OfflineStorageService.getOfflineStorageDir();
      final safeName = content.title.replaceAll(RegExp(r'[^a-zA-Z0-9_\-]'), '_');
      final localFilePath = '${offlineDir.path}/${safeName}_S${episode.seasonNumber}E${episode.episodeNumber}.mp4';

      await _executeStreamDownload(
        id: id,
        url: downloadUrl,
        localFilePath: localFilePath,
      );

      final file = File(localFilePath);
      final fileSizeBytes = await file.length();

      final downloadItem = OfflineDownloadItem(
        id: id,
        contentId: content.id,
        title: content.title,
        episodeTitle: episode.title,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        isSeries: true,
        posterUrl: episode.thumbnailUrl.isNotEmpty ? episode.thumbnailUrl : content.posterUrl,
        localFilePath: localFilePath,
        fileSizeBytes: fileSizeBytes,
        quality: quality,
        downloadedAt: DateTime.now(),
        durationSeconds: episode.duration.toDouble(),
      );

      await OfflineStorageService.saveDownload(downloadItem);

      _statusMap[id] = 'Completed';
      _progressMap[id] = 1.0;
      _activeDownloadIds.remove(id);
      _clients.remove(id);
      notifyListeners();

      onCompleted?.call();
    } catch (e) {
      _activeDownloadIds.remove(id);
      _clients.remove(id);
      _statusMap[id] = 'Failed: ${e.toString()}';
      notifyListeners();
      onError?.call(e.toString());
    }
  }

  String _formatPlayableDownloadUrl(String rawUrl, String title, String quality, String apiBase) {
    final cleanUrl = MediaUrlResolver.resolveMediaUrl(rawUrl, apiBase: apiBase);

    // If HLS (.m3u8) or DASH (.mpd), route through server universal remuxer to output a clean MP4 file
    if (cleanUrl.contains('.m3u8') || cleanUrl.contains('.mpd')) {
      final safeApi = apiBase.endsWith('/') ? apiBase.substring(0, apiBase.length - 1) : apiBase;
      return '$safeApi/media/download-stream?url=${Uri.encodeComponent(cleanUrl)}&title=${Uri.encodeComponent(title)}&quality=$quality';
    }

    return cleanUrl;
  }

  Future<void> _executeStreamDownload({
    required String id,
    required String url,
    required String localFilePath,
  }) async {
    final file = File(localFilePath);
    int totalBytes = 0;
    int receivedBytes = 0;

    // Check if partial download already exists from earlier attempt
    if (await file.exists()) {
      receivedBytes = await file.length();
    }

    int retryCount = 0;
    const maxRetries = 6;

    while (retryCount < maxRetries) {
      if (!_activeDownloadIds.contains(id)) {
        throw Exception('Download was cancelled');
      }

      http.Client? client;
      IOSink? sink;

      try {
        client = http.Client();
        _clients[id] = client;

        final request = http.Request('GET', Uri.parse(url));
        request.headers['User-Agent'] = 'Mozilla/5.0 (Linux; Android 10; MovieBuzz Mobile)';
        request.headers['Referer'] = 'https://cinestream-stream-proxy.dev-patel-codinggita.workers.dev';

        // Request Range if resuming from existing bytes
        if (receivedBytes > 0) {
          request.headers['Range'] = 'bytes=$receivedBytes-';
        }

        final response = await client.send(request);

        // If range was requested and server returned 206 Partial Content
        final isPartial = response.statusCode == 206;
        if (response.statusCode == 200 && receivedBytes > 0) {
          // Server doesn't support Range, must restart from byte 0
          receivedBytes = 0;
          if (await file.exists()) {
            await file.delete();
          }
        } else if (response.statusCode >= 400) {
          throw Exception('Server returned HTTP ${response.statusCode}');
        }

        if (totalBytes <= 0) {
          if (isPartial && response.headers.containsKey('content-range')) {
            final match = RegExp(r'/(\d+)').firstMatch(response.headers['content-range'] ?? '');
            if (match != null) {
              totalBytes = int.tryParse(match.group(1) ?? '') ?? 0;
            }
          }
          if (totalBytes <= 0 && response.contentLength != null) {
            totalBytes = receivedBytes + response.contentLength!;
          }
        }

        sink = file.openWrite(mode: receivedBytes > 0 ? FileMode.append : FileMode.write);
        final completer = Completer<void>();

        response.stream.listen(
          (chunk) {
            sink?.add(chunk);
            receivedBytes += chunk.length;

            if (totalBytes > 0) {
              final progress = (receivedBytes / totalBytes).clamp(0.0, 0.99);
              _progressMap[id] = progress;
              final mbReceived = (receivedBytes / (1024 * 1024)).toStringAsFixed(1);
              final mbTotal = (totalBytes / (1024 * 1024)).toStringAsFixed(1);
              _statusMap[id] = '$mbReceived MB / $mbTotal MB (${(progress * 100).toInt()}%)';
            } else {
              final mbReceived = (receivedBytes / (1024 * 1024)).toStringAsFixed(1);
              _statusMap[id] = '$mbReceived MB downloaded';
              _progressMap[id] = 0.5;
            }
            notifyListeners();
          },
          onDone: () async {
            try {
              await sink?.flush();
              await sink?.close();
            } catch (_) {}
            completer.complete();
          },
          onError: (err) async {
            try {
              await sink?.close();
            } catch (_) {}
            completer.completeError(err);
          },
          cancelOnError: true,
        );

        await completer.future;

        // If we reached here without error, verify completeness
        if (totalBytes <= 0 || receivedBytes >= totalBytes) {
          return; // Successfully finished
        }
      } catch (err) {
        try {
          await sink?.close();
        } catch (_) {}

        if (!_activeDownloadIds.contains(id)) {
          if (await file.exists()) {
            try { await file.delete(); } catch (_) {}
          }
          throw Exception('Download cancelled by user');
        }

        retryCount++;
        if (retryCount >= maxRetries) {
          rethrow;
        }

        _statusMap[id] = 'Reconnecting download (attempt $retryCount/$maxRetries)...';
        notifyListeners();
        await Future.delayed(Duration(seconds: retryCount * 2));
      } finally {
        client?.close();
      }
    }
  }

  void cancelDownload(String id) {
    if (_clients.containsKey(id)) {
      _clients[id]?.close();
      _clients.remove(id);
    }
    _activeDownloadIds.remove(id);
    _progressMap.remove(id);
    _statusMap[id] = 'Cancelled';
    notifyListeners();
  }
}
