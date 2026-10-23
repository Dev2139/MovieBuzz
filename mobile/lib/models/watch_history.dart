import 'content.dart';
import 'episode.dart';

class WatchHistoryItem {
  final String id;
  final String? userId;
  final Content content;
  final Episode? episode;
  final double progress; // in seconds
  final double duration; // in seconds
  final bool completed;
  final DateTime lastWatchedAt;

  WatchHistoryItem({
    required this.id,
    this.userId,
    required this.content,
    this.episode,
    required this.progress,
    required this.duration,
    required this.completed,
    required this.lastWatchedAt,
  });

  double get percentage => (duration > 0) ? (progress / duration).clamp(0.0, 1.0) : 0.0;

  factory WatchHistoryItem.fromJson(Map<String, dynamic> json) {
    Content contentObj;
    if (json['contentId'] is Map<String, dynamic>) {
      contentObj = Content.fromJson(json['contentId']);
    } else {
      contentObj = Content(
        id: json['contentId']?.toString() ?? '',
        title: 'Unknown Title',
        slug: '',
        type: 'movie',
        description: '',
        posterUrl: '',
        backdropUrl: '',
        releaseYear: 0,
        genres: [],
        languages: [],
        cast: [],
        rating: 0,
        popularity: 0,
        featured: false,
        status: 'published',
      );
    }

    Episode? episodeObj;
    if (json['episodeId'] is Map<String, dynamic>) {
      episodeObj = Episode.fromJson(json['episodeId']);
    }

    return WatchHistoryItem(
      id: json['_id']?.toString() ?? '',
      userId: json['userId']?.toString(),
      content: contentObj,
      episode: episodeObj,
      progress: (json['progress'] is num)
          ? (json['progress'] as num).toDouble()
          : double.tryParse(json['progress']?.toString() ?? '0') ?? 0.0,
      duration: (json['duration'] is num)
          ? (json['duration'] as num).toDouble()
          : double.tryParse(json['duration']?.toString() ?? '0') ?? 0.0,
      completed: json['completed'] == true,
      lastWatchedAt: json['lastWatchedAt'] != null
          ? DateTime.tryParse(json['lastWatchedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}
