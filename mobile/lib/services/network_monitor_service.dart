import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../constants/api_constants.dart';

enum NetworkSpeedStatus {
  onlineFast,
  onlineSlow,
  offline,
}

class NetworkMonitorService extends ChangeNotifier {
  static final NetworkMonitorService _instance = NetworkMonitorService._internal();
  factory NetworkMonitorService() => _instance;
  NetworkMonitorService._internal();

  NetworkSpeedStatus _status = NetworkSpeedStatus.onlineFast;
  int _latencyMs = 0;
  DateTime? _lastChecked;
  Timer? _pollingTimer;
  bool _isChecking = false;

  NetworkSpeedStatus get status => _status;
  int get latencyMs => _latencyMs;
  DateTime? get lastChecked => _lastChecked;
  bool get isChecking => _isChecking;

  bool get isOffline => _status == NetworkSpeedStatus.offline;
  bool get isSlow => _status == NetworkSpeedStatus.onlineSlow;
  bool get isProblematic => isOffline || isSlow;

  void startMonitoring() {
    _pollingTimer?.cancel();
    checkConnectivity();
    // Periodically verify connectivity every 15 seconds
    _pollingTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      checkConnectivity();
    });
  }

  void stopMonitoring() {
    _pollingTimer?.cancel();
  }

  /// Manually force status to offline (e.g. when an API call fails with network error)
  void markOffline({String? reason}) {
    if (_status != NetworkSpeedStatus.offline) {
      _status = NetworkSpeedStatus.offline;
      _latencyMs = 9999;
      _lastChecked = DateTime.now();
      notifyListeners();
    }
  }

  /// Manually force status to slow (e.g. when a stream or feed loading times out or lags)
  void markSlow() {
    if (_status != NetworkSpeedStatus.onlineSlow) {
      _status = NetworkSpeedStatus.onlineSlow;
      _latencyMs = 3500;
      _lastChecked = DateTime.now();
      notifyListeners();
    }
  }

  /// Active latency and connectivity check
  Future<NetworkSpeedStatus> checkConnectivity() async {
    if (_isChecking) return _status;
    _isChecking = true;

    try {
      final stopwatch = Stopwatch()..start();

      // Quick DNS check with short timeout
      final result = await InternetAddress.lookup('google.com')
          .timeout(const Duration(milliseconds: 3000));

      if (result.isEmpty || result[0].rawAddress.isEmpty) {
        _status = NetworkSpeedStatus.offline;
        _latencyMs = 9999;
      } else {
        // Measure real HTTP roundtrip latency against the API server or fallback
        final pingUrl = Uri.parse('${ApiConstants.productionBaseUrl}/content?limit=1');
        final response = await http
            .get(pingUrl, headers: {'Accept': 'application/json'})
            .timeout(const Duration(milliseconds: 4000));

        stopwatch.stop();
        _latencyMs = stopwatch.elapsedMilliseconds;

        if (response.statusCode >= 200 && response.statusCode < 500) {
          if (_latencyMs > 2500) {
            _status = NetworkSpeedStatus.onlineSlow;
          } else {
            _status = NetworkSpeedStatus.onlineFast;
          }
        } else {
          // Server returned error but network is alive
          _status = _latencyMs > 2500 ? NetworkSpeedStatus.onlineSlow : NetworkSpeedStatus.onlineFast;
        }
      }
    } on SocketException catch (_) {
      _status = NetworkSpeedStatus.offline;
      _latencyMs = 9999;
    } on TimeoutException catch (_) {
      // Timeout means either extremely slow network or completely unreachable
      _status = NetworkSpeedStatus.offline;
      _latencyMs = 5000;
    } catch (_) {
      _status = NetworkSpeedStatus.offline;
      _latencyMs = 9999;
    } finally {
      _isChecking = false;
      _lastChecked = DateTime.now();
      notifyListeners();
    }

    return _status;
  }

  @override
  void dispose() {
    stopMonitoring();
    super.dispose();
  }
}
