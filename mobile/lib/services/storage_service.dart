import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  static const String _keyToken = 'cinestream_token';
  static const String _keyBaseUrl = 'moviebuzz_custom_api_url';
  static const String _keyLocalWatchlist = 'moviebuzz_local_watchlist';
  static const String _keyLocalFavorites = 'moviebuzz_local_favorites';
  static const String _keyLocalProgress = 'moviebuzz_local_progress';

  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  // Auth Token
  static Future<void> saveToken(String token) async {
    await init();
    await _prefs!.setString(_keyToken, token);
  }

  static String? getToken() {
    return _prefs?.getString(_keyToken);
  }

  static Future<void> clearToken() async {
    await init();
    await _prefs!.remove(_keyToken);
  }

  // Base API URL
  static Future<void> saveBaseUrl(String url) async {
    await init();
    await _prefs!.setString(_keyBaseUrl, url);
  }

  static String? getSavedBaseUrl() {
    return _prefs?.getString(_keyBaseUrl);
  }

  static Future<void> clearBaseUrl() async {
    await init();
    await _prefs!.remove(_keyBaseUrl);
  }

  // Local Watchlist
  static List<String> getLocalWatchlist() {
    return _prefs?.getStringList(_keyLocalWatchlist) ?? [];
  }

  static Future<void> toggleLocalWatchlist(String contentId) async {
    await init();
    final list = getLocalWatchlist();
    if (list.contains(contentId)) {
      list.remove(contentId);
    } else {
      list.add(contentId);
    }
    await _prefs!.setStringList(_keyLocalWatchlist, list);
  }

  // Local Favorites
  static List<String> getLocalFavorites() {
    return _prefs?.getStringList(_keyLocalFavorites) ?? [];
  }

  static Future<void> toggleLocalFavorite(String contentId) async {
    await init();
    final list = getLocalFavorites();
    if (list.contains(contentId)) {
      list.remove(contentId);
    } else {
      list.add(contentId);
    }
    await _prefs!.setStringList(_keyLocalFavorites, list);
  }

  // Local Playback Progress: Map of contentId -> { progress, duration, updatedAt }
  static Map<String, dynamic> getLocalProgress(String contentId) {
    final raw = _prefs?.getString('$_keyLocalProgress:$contentId');
    if (raw != null) {
      try {
        return jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {}
    }
    return {};
  }

  static Future<void> saveLocalProgress({
    required String contentId,
    String? episodeId,
    required double progress,
    required double duration,
  }) async {
    await init();
    final data = {
      'contentId': contentId,
      'episodeId': episodeId,
      'progress': progress,
      'duration': duration,
      'updatedAt': DateTime.now().toIso8601String(),
    };
    await _prefs!.setString('$_keyLocalProgress:$contentId', jsonEncode(data));
  }
}
