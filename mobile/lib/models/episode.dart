class Episode {
  final String id;
  final String seriesId;
  final String seasonId;
  final int? seasonNumber;
  final int episodeNumber;
  final String title;
  final String? description;
  final String thumbnailUrl;
  final int duration;
  final String? releaseDate;
  final double? rating;

  Episode({
    required this.id,
    required this.seriesId,
    required this.seasonId,
    this.seasonNumber,
    required this.episodeNumber,
    required this.title,
    this.description,
    required this.thumbnailUrl,
    required this.duration,
    this.releaseDate,
    this.rating,
  });

  factory Episode.fromJson(Map<String, dynamic> json) {
    return Episode(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      seriesId: json['seriesId']?.toString() ?? '',
      seasonId: json['seasonId']?.toString() ?? '',
      seasonNumber: json['seasonNumber'] is int
          ? json['seasonNumber']
          : int.tryParse(json['seasonNumber']?.toString() ?? ''),
      episodeNumber: json['episodeNumber'] is int
          ? json['episodeNumber']
          : int.tryParse(json['episodeNumber']?.toString() ?? '1') ?? 1,
      title: json['title']?.toString() ?? 'Episode',
      description: json['description']?.toString(),
      thumbnailUrl: json['thumbnailUrl']?.toString() ?? '',
      duration: json['duration'] is int
          ? json['duration']
          : int.tryParse(json['duration']?.toString() ?? '0') ?? 0,
      releaseDate: json['releaseDate']?.toString(),
      rating: (json['rating'] is num)
          ? (json['rating'] as num).toDouble()
          : double.tryParse(json['rating']?.toString() ?? ''),
    );
  }
}
