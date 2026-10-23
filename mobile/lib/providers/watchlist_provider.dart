import 'package:flutter/foundation.dart';
import '../models/content.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class WatchlistProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<Content> _watchlist = [];
  List<Content> _favorites = [];
  final Set<String> _watchlistIds = {};
  final Set<String> _favoriteIds = {};

  bool _isLoading = false;

  List<Content> get watchlist => _watchlist;
  List<Content> get favorites => _favorites;
  bool get isLoading => _isLoading;

  bool isInWatchlist(String contentId) => _watchlistIds.contains(contentId);
  bool isFavorite(String contentId) => _favoriteIds.contains(contentId);

  Future<void> loadUserLists() async {
    _isLoading = true;
    notifyListeners();

    try {
      final results = await Future.wait([
        _api.getUserWatchlist(),
        _api.getUserFavorites(),
      ]);

      _watchlist = results[0];
      _favorites = results[1];

      _watchlistIds.clear();
      for (final item in _watchlist) {
        _watchlistIds.add(item.id);
      }

      _favoriteIds.clear();
      for (final item in _favorites) {
        _favoriteIds.add(item.id);
      }

      // Add local cached IDs as fallback
      _watchlistIds.addAll(StorageService.getLocalWatchlist());
      _favoriteIds.addAll(StorageService.getLocalFavorites());
    } catch (_) {
      // Local cache fallback
      _watchlistIds.addAll(StorageService.getLocalWatchlist());
      _favoriteIds.addAll(StorageService.getLocalFavorites());
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> toggleWatchlist(Content content) async {
    final willAdd = !_watchlistIds.contains(content.id);
    if (willAdd) {
      _watchlistIds.add(content.id);
      if (!_watchlist.any((c) => c.id == content.id)) {
        _watchlist.insert(0, content);
      }
    } else {
      _watchlistIds.remove(content.id);
      _watchlist.removeWhere((c) => c.id == content.id);
    }
    notifyListeners();

    try {
      await _api.toggleWatchlist(content.id);
    } catch (_) {}
  }

  Future<void> toggleFavorite(Content content) async {
    final willAdd = !_favoriteIds.contains(content.id);
    if (willAdd) {
      _favoriteIds.add(content.id);
      if (!_favorites.any((c) => c.id == content.id)) {
        _favorites.insert(0, content);
      }
    } else {
      _favoriteIds.remove(content.id);
      _favorites.removeWhere((c) => c.id == content.id);
    }
    notifyListeners();

    try {
      await _api.toggleFavorite(content.id);
    } catch (_) {}
  }
}
