import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'constants/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/content_provider.dart';
import 'providers/watchlist_provider.dart';
import 'screens/main_screen.dart';
import 'services/storage_service.dart';
import 'services/download_service.dart';
import 'services/network_monitor_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set system UI overlay style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF0D0D14),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Initialize local persistent storage
  await StorageService.init();

  // Start network monitor
  NetworkMonitorService().startMonitoring();

  runApp(const MovieBuzzApp());
}

class SmoothScrollBehavior extends MaterialScrollBehavior {
  const SmoothScrollBehavior();

  @override
  Set<PointerDeviceKind> get dragDevices => {
        PointerDeviceKind.touch,
        PointerDeviceKind.mouse,
        PointerDeviceKind.trackpad,
        PointerDeviceKind.stylus,
      };

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    return const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());
  }
}

class MovieBuzzApp extends StatelessWidget {
  const MovieBuzzApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ContentProvider()),
        ChangeNotifierProvider(create: (_) => WatchlistProvider()),
        ChangeNotifierProvider(create: (_) => DownloadService()),
        ChangeNotifierProvider(create: (_) => NetworkMonitorService()),
      ],
      child: MaterialApp(
        title: 'MovieBuzz',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        scrollBehavior: const SmoothScrollBehavior(),
        home: const MainScreen(),
      ),
    );
  }
}
