class ApiConstants {
  // Deployed Render backend (handles Database, Auth, Catalog, and Telegram MTProto media)
  static const String deployedRenderBackend = 'https://moviebuzz-qr1i.onrender.com';
  static const String productionBaseUrl = 'https://moviebuzz-qr1i.onrender.com/api';

  // Deployed Cloudflare Stream Worker (handles high-speed CDN streaming, edge caching, and CORS bypass)
  static const String cloudflareStreamProxyUrl = 'https://cinestream-stream-proxy.dev-patel-codinggita.workers.dev';

  // Mobile App Release Version
  static const String appVersion = '2.5.0';
  static const int appVersionCode = 25;

  // Local development backend presets
  static const String localHostBaseUrl = 'http://localhost:5000/api';
  static const String androidEmulatorBaseUrl = 'http://10.0.2.2:5000/api';
  static const String localLanBaseUrl = 'http://10.251.45.90:5000/api';

  // Default URL used by mobile app - directly connects to deployed Render backend
  static String get defaultBaseUrl => productionBaseUrl;

  // Endpoints
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String me = '/auth/me';
  static const String logout = '/auth/logout';

  static const String content = '/content';
  static const String movies = '/movies';
  static const String series = '/series';
  static const String genres = '/genres';
  static const String search = '/search';

  static const String continueWatching = '/users/continue-watching';
  static const String userHistory = '/users/history';
  static const String userWatchlist = '/users/watchlist';
  static const String userFavorites = '/users/favorites';
  static const String recommendations = '/recommendations';

  static const String requests = '/requests';
  static const String requestsLeaderboard = '/requests/leaderboard';

  static const String streamWatch = '/media';
}
