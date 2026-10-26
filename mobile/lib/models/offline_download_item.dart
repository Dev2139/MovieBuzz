class OfflineDownloadItem {
  final String id;
  final String contentId;
  final String title;
  final String? episodeTitle;
  final int? seasonNumber;
  final int? episodeNumber;
  final bool isSeries;
  final String posterUrl;
  final String localFilePath;
  final int fileSizeBytes;
  final String quality;
  final DateTime downloadedAt;
  final double durationSeconds;

  OfflineDownloadItem({
    required this.id,
    required this.contentId,
    required this.title,
    this.episodeTitle,
    this.seasonNumber,
    this.episodeNumber,
    this.isSeries = false,
    required this.posterUrl,
    required this.localFilePath,
    required this.fileSizeBytes,
    required this.quality,
    required this.downloadedAt,
    this.durationSeconds = 0,
  });

  String get displayTitle {
    if (isSeries && seasonNumber != null && episodeNumber != null) {
      final epName = episodeTitle != null && episodeTitle!.isNotEmpty ? ': $episodeTitle' : '';
      return '$title - S${seasonNumber}E$episodeNumber$epName';
    }
    return title;
  }

  String get formattedSize {
    if (fileSizeBytes < 1024 * 1024) {
      return '${(fileSizeBytes / 1024).toStringAsFixed(1)} KB';
    } else if (fileSizeBytes < 1024 * 1024 * 1024) {
      return '${(fileSizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    } else {
      return '${(fileSizeBytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB';
    }
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'contentId': contentId,
        'title': title,
        'episodeTitle': episodeTitle,
        'seasonNumber': seasonNumber,
        'episodeNumber': episodeNumber,
        'isSeries': isSeries,
        'posterUrl': posterUrl,
        'localFilePath': localFilePath,
        'fileSizeBytes': fileSizeBytes,
        'quality': quality,
        'downloadedAt': downloadedAt.toIso8601String(),
        'durationSeconds': durationSeconds,
      };

  factory OfflineDownloadItem.fromJson(Map<String, dynamic> json) {
    return OfflineDownloadItem(
      id: json['id'] as String,
      contentId: json['contentId'] as String,
      title: json['title'] as String,
      episodeTitle: json['episodeTitle'] as String?,
      seasonNumber: json['seasonNumber'] as int?,
      episodeNumber: json['episodeNumber'] as int?,
      isSeries: json['isSeries'] as bool? ?? false,
      posterUrl: json['posterUrl'] as String? ?? '',
      localFilePath: json['localFilePath'] as String,
      fileSizeBytes: json['fileSizeBytes'] as int? ?? 0,
      quality: json['quality'] as String? ?? '1080p',
      downloadedAt: json['downloadedAt'] != null
          ? DateTime.tryParse(json['downloadedAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      durationSeconds: (json['durationSeconds'] as num?)?.toDouble() ?? 0,
    );
  }
}
