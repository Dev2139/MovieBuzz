import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/offline_download_item.dart';

class OfflineStorageService {
  static const String _keyOfflineDownloads = 'moviebuzz_offline_downloads_cache';

  static Future<Directory> getOfflineStorageDir() async {
    final appDir = await getApplicationDocumentsDirectory();
    final offlineDir = Directory('${appDir.path}/offline_movies');
    if (!await offlineDir.exists()) {
      await offlineDir.create(recursive: true);
    }
    return offlineDir;
  }

  static Future<List<OfflineDownloadItem>> getDownloads() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_keyOfflineDownloads);
    if (raw == null || raw.trim().isEmpty) return [];

    try {
      final List<dynamic> list = jsonDecode(raw);
      final items = <OfflineDownloadItem>[];
      for (final itemJson in list) {
        final item = OfflineDownloadItem.fromJson(itemJson as Map<String, dynamic>);
        // Verify local file still exists on disk
        final file = File(item.localFilePath);
        if (await file.exists()) {
          items.add(item);
        }
      }
      return items;
    } catch (_) {
      return [];
    }
  }

  static Future<Set<String>> getDownloadedIds() async {
    final list = await getDownloads();
    return list.map((i) => i.id).toSet();
  }

  static Future<void> saveDownload(OfflineDownloadItem item) async {
    final prefs = await SharedPreferences.getInstance();
    final current = await getDownloads();
    current.removeWhere((i) => i.id == item.id);
    current.insert(0, item);

    final raw = jsonEncode(current.map((i) => i.toJson()).toList());
    await prefs.setString(_keyOfflineDownloads, raw);
  }

  static Future<void> deleteDownload(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final current = await getDownloads();
    final toRemove = current.where((i) => i.id == id).toList();

    for (final item in toRemove) {
      try {
        final file = File(item.localFilePath);
        if (await file.exists()) {
          await file.delete();
        }
      } catch (_) {}
    }

    current.removeWhere((i) => i.id == id);
    final raw = jsonEncode(current.map((i) => i.toJson()).toList());
    await prefs.setString(_keyOfflineDownloads, raw);
  }

  static Future<bool> isDownloaded(String id) async {
    final current = await getDownloads();
    final match = current.where((i) => i.id == id).toList();
    if (match.isEmpty) return false;
    final file = File(match.first.localFilePath);
    return file.exists();
  }

  static Future<OfflineDownloadItem?> getDownload(String id) async {
    final current = await getDownloads();
    final match = current.where((i) => i.id == id).toList();
    if (match.isEmpty) return null;
    return match.first;
  }

  static Future<int> getTotalStorageUsedBytes() async {
    final items = await getDownloads();
    int total = 0;
    for (final item in items) {
      total += item.fileSizeBytes;
    }
    return total;
  }
}
