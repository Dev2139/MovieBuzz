import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants/api_constants.dart';
import '../models/content.dart';
import '../models/season.dart';
import '../models/episode.dart';
import '../models/media.dart';
import '../models/user.dart';
import '../models/watch_history.dart';
import '../models/content_request.dart';
import 'storage_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String _baseUrl = ApiConstants.defaultBaseUrl;
  String get baseUrl => _baseUrl;

  void setBaseUrl(String url) {
    var clean = url.trim();
    while (clean.endsWith('/')) {
      clean = clean.substring(0, clean.length - 1);
    }
    if (!clean.endsWith('/api')) {
      clean += '/api';
    }
    _baseUrl = clean;
    StorageService.saveBaseUrl(_baseUrl);
  }

  void init() {
    final saved = StorageService.getSavedBaseUrl();
    if (saved != null && saved.isNotEmpty) {
      if (saved.contains('localhost') || saved.contains('10.0.2.2') || saved.contains('10.251.')) {
        _baseUrl = ApiConstants.defaultBaseUrl;
      } else {
        _baseUrl = saved;
      }
    }
  }

  Map<String, String> _headers() {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    final token = StorageService.getToken();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Uri _buildUri(String path, [Map<String, dynamic>? queryParameters]) {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final fullUrl = '$_baseUrl$cleanPath';

    if (queryParameters == null || queryParameters.isEmpty) {
      return Uri.parse(fullUrl);
    }

    final queryMap = <String, String>{};
    queryParameters.forEach((key, value) {
      if (value != null && value.toString().isNotEmpty) {
        queryMap[key] = value.toString();
      }
    });

    return Uri.parse(fullUrl).replace(queryParameters: queryMap);
  }

  // --- Auth APIs ---
  Future<Map<String, dynamic>> login(String email, String password) async {
    final url = _buildUri(ApiConstants.login);
    final response = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Failed to login');
    }
  }

  Future<Map<String, dynamic>> register(String name, String email, String password) async {
    final url = _buildUri(ApiConstants.register);
    final response = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({'name': name, 'email': email, 'password': password}),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Failed to register');
    }
  }

  Future<User?> getMe() async {
    final token = StorageService.getToken();
    if (token == null) return null;

    final url = _buildUri(ApiConstants.me);
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data['user'] != null) {
        return User.fromJson(data['user']);
      }
    }
    return null;
  }

  Future<void> logout() async {
    try {
      final url = _buildUri(ApiConstants.logout);
      await http.post(url, headers: _headers());
    } catch (_) {}
    await StorageService.clearToken();
  }

  // --- Content & Catalog APIs ---
  Future<List<Content>> getContentList({
    String? type,
    String? genre,
    String? search,
    bool? featured,
    int page = 1,
    int limit = 20,
    String? sort,
  }) async {
    final params = <String, dynamic>{
      if (type != null) 'type': type,
      if (genre != null) 'genre': genre,
      if (search != null) 'search': search,
      if (featured != null) 'featured': featured.toString(),
      'page': page,
      'limit': limit,
      if (sort != null) 'sort': sort,
    };

    final url = _buildUri(ApiConstants.content, params);
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final list = (data['items'] as List<dynamic>?) ?? [];
      return list.map((e) => Content.fromJson(e)).toList();
    }
    return [];
  }

  Future<List<Content>> getMovies({
    String? genre,
    int page = 1,
    int limit = 20,
    String? sort,
  }) async {
    final params = <String, dynamic>{
      if (genre != null) 'genre': genre,
      'page': page,
      'limit': limit,
      if (sort != null) 'sort': sort,
    };
    final url = _buildUri(ApiConstants.movies, params);
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final list = (data['items'] as List<dynamic>?) ?? [];
      return list.map((e) => Content.fromJson(e)).toList();
    }
    return [];
  }

  Future<List<Content>> getSeries({
    String? genre,
    int page = 1,
    int limit = 20,
    String? sort,
  }) async {
    final params = <String, dynamic>{
      if (genre != null) 'genre': genre,
      'page': page,
      'limit': limit,
      if (sort != null) 'sort': sort,
    };
    final url = _buildUri(ApiConstants.series, params);
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final list = (data['items'] as List<dynamic>?) ?? [];
      return list.map((e) => Content.fromJson(e)).toList();
    }
    return [];
  }

  Future<List<String>> getGenres() async {
    final url = _buildUri(ApiConstants.genres);
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return (data['genres'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [];
    }
    return [];
  }

  Future<Map<String, dynamic>> getContentBySlug(String slug) async {
    final url = _buildUri('/content/$slug');
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final content = Content.fromJson(data['content']);
      final mediaList = ((data['media'] as List<dynamic>?) ?? [])
          .map((e) => Media.fromJson(e))
          .toList();
      return {'content': content, 'media': mediaList};
    }
    throw Exception('Content not found');
  }

  Future<List<Season>> getSeriesSeasons(String seriesId) async {
    final url = _buildUri('/series/$seriesId/seasons');
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return ((data['seasons'] as List<dynamic>?) ?? [])
          .map((e) => Season.fromJson(e))
          .toList();
    }
    return [];
  }

  Future<List<Episode>> getSeasonEpisodes(String seasonId) async {
    final url = _buildUri('/seasons/$seasonId/episodes');
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return ((data['episodes'] as List<dynamic>?) ?? [])
          .map((e) => Episode.fromJson(e))
          .toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> getSeriesEpisodeByNumber(
      String seriesSlug, int seasonNumber, int episodeNumber) async {
    final url = _buildUri('/series-watch/$seriesSlug/$seasonNumber/$episodeNumber');
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return {
        'series': Content.fromJson(data['series']),
        'season': Season.fromJson(data['season']),
        'episode': Episode.fromJson(data['episode']),
        'media': ((data['media'] as List<dynamic>?) ?? [])
            .map((e) => Media.fromJson(e))
            .toList(),
        'playlist': ((data['playlist'] as List<dynamic>?) ?? [])
            .map((e) => Episode.fromJson(e))
            .toList(),
      };
    }
    throw Exception('Failed to load episode');
  }

  Future<Map<String, dynamic>> getMediaStream(String mediaId) async {
    final url = _buildUri('/media/$mediaId/watch');
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to load stream');
  }

  Future<Map<String, dynamic>> search(String query) async {
    final url = _buildUri(ApiConstants.search, {'q': query});
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final movies = ((data['movies'] as List<dynamic>?) ?? [])
          .map((e) => Content.fromJson(e))
          .toList();
      final series = ((data['series'] as List<dynamic>?) ?? [])
          .map((e) => Content.fromJson(e))
          .toList();
      return {'movies': movies, 'series': series};
    }
    return {'movies': <Content>[], 'series': <Content>[]};
  }

  // --- Watch History & Continue Watching ---
  Future<List<WatchHistoryItem>> getContinueWatching() async {
    final url = _buildUri(ApiConstants.continueWatching);
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return ((data['continueWatching'] as List<dynamic>?) ?? [])
          .map((e) => WatchHistoryItem.fromJson(e))
          .toList();
    }
    return [];
  }

  Future<List<WatchHistoryItem>> getUserHistory() async {
    final url = _buildUri(ApiConstants.userHistory);
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return ((data['history'] as List<dynamic>?) ?? [])
          .map((e) => WatchHistoryItem.fromJson(e))
          .toList();
    }
    return [];
  }

  Future<void> saveWatchProgress({
    required String contentId,
    String? episodeId,
    required double progress,
    required double duration,
    bool completed = false,
  }) async {
    try {
      final url = _buildUri(ApiConstants.userHistory);
      await http.post(
        url,
        headers: _headers(),
        body: jsonEncode({
          'contentId': contentId,
          if (episodeId != null) 'episodeId': episodeId,
          'progress': progress,
          'duration': duration,
          'completed': completed,
        }),
      );
    } catch (_) {}
    // Also store locally for offline backup
    await StorageService.saveLocalProgress(
      contentId: contentId,
      episodeId: episodeId,
      progress: progress,
      duration: duration,
    );
  }

  // --- Watchlist & Favorites ---
  Future<List<Content>> getUserWatchlist() async {
    final url = _buildUri(ApiConstants.userWatchlist);
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return ((data['watchlist'] as List<dynamic>?) ?? [])
          .map((e) => Content.fromJson(e))
          .toList();
    }
    return [];
  }

  Future<bool> toggleWatchlist(String contentId) async {
    final url = _buildUri('/users/watchlist/$contentId');
    final response = await http.post(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['inWatchlist'] == true;
    }
    // Fallback to local storage
    await StorageService.toggleLocalWatchlist(contentId);
    return StorageService.getLocalWatchlist().contains(contentId);
  }

  Future<List<Content>> getUserFavorites() async {
    final url = _buildUri(ApiConstants.userFavorites);
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return ((data['favorites'] as List<dynamic>?) ?? [])
          .map((e) => Content.fromJson(e))
          .toList();
    }
    return [];
  }

  Future<bool> toggleFavorite(String contentId) async {
    final url = _buildUri('/users/favorites/$contentId');
    final response = await http.post(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['isFavorite'] == true;
    }
    await StorageService.toggleLocalFavorite(contentId);
    return StorageService.getLocalFavorites().contains(contentId);
  }

  // --- Requests Leaderboard ---
  Future<List<ContentRequestItem>> getRequestsLeaderboard({
    String? search,
    String? type,
  }) async {
    final params = <String, dynamic>{
      if (search != null) 'search': search,
      if (type != null) 'type': type,
    };
    final url = _buildUri(ApiConstants.requestsLeaderboard, params);
    final response = await http.get(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return ((data['requests'] as List<dynamic>?) ?? [])
          .map((e) => ContentRequestItem.fromJson(e))
          .toList();
    }
    return [];
  }

  Future<int> voteRequest(String requestId) async {
    final url = _buildUri('/requests/$requestId/vote');
    final response = await http.post(url, headers: _headers());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['voteCount'] ?? 0;
    }
    throw Exception('Failed to cast vote');
  }

  Future<void> submitRequest({
    required String title,
    String type = 'movie',
    int? releaseYear,
    String? notes,
  }) async {
    final url = _buildUri(ApiConstants.requests);
    final response = await http.post(
      url,
      headers: _headers(),
      body: jsonEncode({
        'title': title,
        'type': type,
        if (releaseYear != null) 'releaseYear': releaseYear,
        if (notes != null) 'notes': notes,
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final data = jsonDecode(response.body);
      throw Exception(data['message'] ?? 'Failed to submit request');
    }
  }

  Future<Map<String, dynamic>?> getLatestAppUpdate() async {
    try {
      final url = _buildUri('/app-updates/latest');
      final response = await http.get(url, headers: _headers());
      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  /// Resolves high-speed MovieBox Edge CDN and embed streams (4K, 1080p, 720p, 420p, Dubs)
  Future<Map<String, dynamic>> resolveStreamingSources({
    required String title,
    int? year,
    String type = 'movie',
    int? season,
    int? episode,
    String? imdbId,
    String? tmdbId,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'title': title,
        if (year != null && year > 0) 'year': year.toString(),
        'type': type,
        if (season != null && season > 0) 'season': season.toString(),
        if (episode != null && episode > 0) 'episode': episode.toString(),
        if (imdbId != null && imdbId.isNotEmpty) 'imdbId': imdbId,
        if (tmdbId != null && tmdbId.isNotEmpty) 'tmdbId': tmdbId,
      };
      final url = _buildUri('/streaming/resolve', queryParams);
      final response = await http.get(url, headers: _headers());
      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return {'sources': [], 'dubs': [], 'subtitles': []};
  }
}
