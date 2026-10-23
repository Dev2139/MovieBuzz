class Media {
  final String id;
  final String? contentId;
  final String? episodeId;
  final String quality;
  final String resolution;
  final String? fileSize;
  final int? duration;
  final String mimeType;
  final String? format;
  final String provider;
  final String streamUrl;
  final String? downloadUrl;
  final String? audioLang;
  final String? audioName;

  Media({
    required this.id,
    this.contentId,
    this.episodeId,
    required this.quality,
    required this.resolution,
    this.fileSize,
    this.duration,
    required this.mimeType,
    this.format,
    required this.provider,
    required this.streamUrl,
    this.downloadUrl,
    this.audioLang,
    this.audioName,
  });

  factory Media.fromJson(Map<String, dynamic> json) {
    return Media(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      contentId: json['contentId']?.toString(),
      episodeId: json['episodeId']?.toString(),
      quality: json['quality']?.toString() ?? '1080p',
      resolution: json['resolution']?.toString() ?? '1920x1080',
      fileSize: json['fileSize']?.toString(),
      duration: json['duration'] is int
          ? json['duration']
          : int.tryParse(json['duration']?.toString() ?? ''),
      mimeType: json['mimeType']?.toString() ?? 'video/mp4',
      format: json['format']?.toString(),
      provider: json['provider']?.toString() ?? 'local',
      streamUrl: json['streamUrl']?.toString() ?? '',
      downloadUrl: json['downloadUrl']?.toString(),
      audioLang: json['audioLang']?.toString(),
      audioName: json['audioName']?.toString(),
    );
  }
}
