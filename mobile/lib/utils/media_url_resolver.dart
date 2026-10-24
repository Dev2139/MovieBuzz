import '../constants/api_constants.dart';

class MediaUrlResolver {
  /// Resolves media stream and download URLs against the active deployed Render backend,
  /// replacing legacy localhost or relative endpoints with the deployed server.
  static String resolveMediaUrl(String? rawUrl, {String? apiBase}) {
    if (rawUrl == null || rawUrl.trim().isEmpty) return '';
    var clean = rawUrl.trim();

    final base = (apiBase != null && apiBase.isNotEmpty)
        ? apiBase
        : ApiConstants.productionBaseUrl;
    final backendOrigin = base.replaceAll(RegExp(r'/api/?$'), '');

    if (clean.contains('/api/media/')) {
      final mediaPath = clean.substring(clean.indexOf('/api/media/'));
      return '$backendOrigin$mediaPath';
    }
    if (clean.contains('/api/streaming/')) {
      final streamPath = clean.substring(clean.indexOf('/api/streaming/'));
      return '$backendOrigin$streamPath';
    }
    if (clean.startsWith('http://localhost:5000')) {
      return clean.replaceFirst('http://localhost:5000', backendOrigin);
    }
    if (clean.startsWith('http://10.0.2.2:5000')) {
      return clean.replaceFirst('http://10.0.2.2:5000', backendOrigin);
    }
    if (clean.startsWith('/api/')) {
      return '$backendOrigin$clean';
    }
    if (clean.startsWith('/')) {
      return '$backendOrigin$clean';
    }

    return clean;
  }

  /// Wraps external/CDN streams with Cloudflare edge stream worker proxy
  /// (cinestream-proxy.dev-patel-codinggita.workers.dev) for edge-caching and CORS bypass.
  static String wrapStreamWithCloudflare(String? rawUrl, {String? apiBase}) {
    if (rawUrl == null || rawUrl.trim().isEmpty) return '';
    final resolved = resolveMediaUrl(rawUrl, apiBase: apiBase);

    // If already routed through Cloudflare, do not double wrap
    if (resolved.contains('workers.dev') || resolved.contains('cloudflare')) {
      return resolved;
    }

    final cfProxy = ApiConstants.cloudflareStreamProxyUrl.replaceAll(RegExp(r'/+$'), '');

    // Route Telegram proxy-file streams through Cloudflare /tg/ edge cache for fastest chunk loading
    if (resolved.contains('/proxy-file/')) {
      final fileId = resolved.substring(resolved.indexOf('/proxy-file/') + '/proxy-file/'.length);
      return '$cfProxy/tg/$fileId';
    }

    if (resolved.contains('/media/') || resolved.contains('/streaming/')) {
      return resolved;
    }

    // For external CDNs, HLS (.m3u8), DASH (.mpd), or MP4 streams, route via Cloudflare worker
    final marker = resolved.contains('.m3u8')
        ? '.m3u8'
        : resolved.contains('.mpd')
            ? '.mpd'
            : '.mp4';

    return '$cfProxy/embed?url=${Uri.encodeComponent(resolved)}&ext=$marker';
  }
}
