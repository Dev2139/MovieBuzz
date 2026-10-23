import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  User? _user;
  bool _isLoading = true;
  String? _error;

  User? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isLoading => _isLoading;
  String? get error => _error;

  String get currentBaseUrl => _api.baseUrl;

  AuthProvider() {
    initAuth();
  }

  Future<void> initAuth() async {
    _isLoading = true;
    notifyListeners();

    _api.init();

    try {
      final token = StorageService.getToken();
      if (token != null && token.isNotEmpty) {
        _user = await _api.getMe();
      }
    } catch (e) {
      _user = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await _api.login(email, password);
      final token = res['token']?.toString();
      if (token != null) {
        await StorageService.saveToken(token);
      }
      if (res['user'] != null) {
        _user = User.fromJson(res['user']);
      }
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(String name, String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await _api.register(name, email, password);
      final token = res['token']?.toString();
      if (token != null) {
        await StorageService.saveToken(token);
      }
      if (res['user'] != null) {
        _user = User.fromJson(res['user']);
      }
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();
    await _api.logout();
    _user = null;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> refreshUser() async {
    try {
      final updated = await _api.getMe();
      if (updated != null) {
        _user = updated;
        notifyListeners();
      }
    } catch (_) {}
  }

  void updateBaseUrl(String newUrl) {
    _api.setBaseUrl(newUrl);
    notifyListeners();
    initAuth();
  }
}
