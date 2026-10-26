import 'package:flutter/foundation.dart';
import '../models/content.dart';
import '../models/watch_history.dart';
import '../services/api_service.dart';
import '../services/network_monitor_service.dart';

class ContentProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<Content> _featured = [];
  List<Content> _trendingMovies = [];
  List<Content> _popularSeries = [];
  List<WatchHistoryItem> _continueWatching = [];
  List<String> _genres = [];

  bool _isLoading = false;
  String? _error;

  List<Content> get featured => _featured;
  List<Content> get trendingMovies => _trendingMovies;
  List<Content> get popularSeries => _popularSeries;
  List<WatchHistoryItem> get continueWatching => _continueWatching;
  List<String> get genres => _genres;

  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadHomeFeed() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _api.getContentList(featured: true, limit: 10),
        _api.getMovies(limit: 30, sort: 'popularity'),
        _api.getSeries(limit: 30, sort: 'popularity'),
        _api.getContinueWatching(),
        _api.getGenres(),
      ]);

      _featured = results[0] as List<Content>;
      _trendingMovies = results[1] as List<Content>;
      _popularSeries = results[2] as List<Content>;
      _continueWatching = results[3] as List<WatchHistoryItem>;
      _genres = results[4] as List<String>;

      // Fallback if no featured items explicitly flagged: use first few movies
      if (_featured.isEmpty && _trendingMovies.isNotEmpty) {
        _featured = _trendingMovies.take(4).toList();
      }
    } catch (e) {
      _error = e.toString();
      NetworkMonitorService().markOffline(reason: e.toString());
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshContinueWatching() async {
    try {
      _continueWatching = await _api.getContinueWatching();
      notifyListeners();
    } catch (_) {}
  }
}
