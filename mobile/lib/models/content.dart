class Content {
  final String id;
  final String title;
  final String slug;
  final String type; // 'movie' or 'series'
  final String description;
  final String posterUrl;
  final String backdropUrl;
  final String? trailerUrl;
  final int releaseYear;
  final List<String> genres;
  final List<String> languages;
  final List<String> cast;
  final String? director;
  final double rating;
  final int popularity;
  final bool featured;
  final String status;
  final int? tmdbId;
  final String? imdbId;

  Content({
    required this.id,
    required this.title,
    required this.slug,
    required this.type,
    required this.description,
    required this.posterUrl,
    required this.backdropUrl,
    this.trailerUrl,
    required this.releaseYear,
    required this.genres,
    required this.languages,
    required this.cast,
    this.director,
    required this.rating,
    required this.popularity,
    required this.featured,
    required this.status,
    this.tmdbId,
    this.imdbId,
  });

  bool get isMovie => type == 'movie';
  bool get isSeries => type == 'series';

  factory Content.fromJson(Map<String, dynamic> json) {
    return Content(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      type: json['type']?.toString() ?? 'movie',
      description: json['description']?.toString() ?? '',
      posterUrl: json['posterUrl']?.toString() ?? '',
      backdropUrl: json['backdropUrl']?.toString() ?? '',
      trailerUrl: json['trailerUrl']?.toString(),
      releaseYear: json['releaseYear'] is int
          ? json['releaseYear']
          : int.tryParse(json['releaseYear']?.toString() ?? '') ?? 0,
      genres: (json['genres'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      languages: (json['languages'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      cast: (json['cast'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      director: json['director']?.toString(),
      rating: (json['rating'] is num)
          ? (json['rating'] as num).toDouble()
          : double.tryParse(json['rating']?.toString() ?? '0') ?? 0.0,
      popularity: json['popularity'] is int
          ? json['popularity']
          : int.tryParse(json['popularity']?.toString() ?? '0') ?? 0,
      featured: json['featured'] == true,
      status: json['status']?.toString() ?? 'published',
      tmdbId: json['tmdbId'] is int
          ? json['tmdbId']
          : int.tryParse(json['tmdbId']?.toString() ?? ''),
      imdbId: json['imdbId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'title': title,
      'slug': slug,
      'type': type,
      'description': description,
      'posterUrl': posterUrl,
      'backdropUrl': backdropUrl,
      'trailerUrl': trailerUrl,
      'releaseYear': releaseYear,
      'genres': genres,
      'languages': languages,
      'cast': cast,
      'director': director,
      'rating': rating,
      'popularity': popularity,
      'featured': featured,
      'status': status,
      'tmdbId': tmdbId,
      'imdbId': imdbId,
    };
  }
}
