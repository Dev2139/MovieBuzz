class Season {
  final String id;
  final String seriesId;
  final int seasonNumber;
  final String title;
  final String? description;
  final String? posterUrl;
  final int releaseYear;

  Season({
    required this.id,
    required this.seriesId,
    required this.seasonNumber,
    required this.title,
    this.description,
    this.posterUrl,
    required this.releaseYear,
  });

  factory Season.fromJson(Map<String, dynamic> json) {
    return Season(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      seriesId: json['seriesId']?.toString() ?? '',
      seasonNumber: json['seasonNumber'] is int
          ? json['seasonNumber']
          : int.tryParse(json['seasonNumber']?.toString() ?? '1') ?? 1,
      title: json['title']?.toString() ?? 'Season 1',
      description: json['description']?.toString(),
      posterUrl: json['posterUrl']?.toString(),
      releaseYear: json['releaseYear'] is int
          ? json['releaseYear']
          : int.tryParse(json['releaseYear']?.toString() ?? '') ?? 0,
    );
  }
}
