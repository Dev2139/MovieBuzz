import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../constants/app_colors.dart';
import '../../constants/api_constants.dart';

class AppUpdateScreen extends StatelessWidget {
  final Map<String, dynamic> updateInfo;

  const AppUpdateScreen({super.key, required this.updateInfo});

  Future<void> _openWebsiteDownload(BuildContext context) async {
    final uri = Uri.parse(ApiConstants.websiteDownloadUrl);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open website: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  Future<void> _directDownloadApk(BuildContext context) async {
    final downloadPath = updateInfo['downloadUrl'] as String? ?? '/moviebuzz.apk';
    String fullUrl;
    if (downloadPath.startsWith('http')) {
      fullUrl = downloadPath;
    } else {
      fullUrl = 'https://cinestream.devdhar.in$downloadPath';
    }

    final uri = Uri.parse(fullUrl);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final version = updateInfo['version'] ?? '2.9.0';
    final title = updateInfo['title'] ?? 'MovieBuzz v$version — Official Release';
    final changelog = updateInfo['changelog'] ??
        '• Cloudflare Edge High-Speed Streaming Engine\n• Direct Website APK Download & Auto-Install\n• Zero-Buffer Playback & Instant Audio Switching\n• Enhanced Player Gestures & Offline Mode';
    final apkSize = updateInfo['apkSize'] ?? '54 MB';
    final isMandatory = updateInfo['isMandatory'] == true;

    return WillPopScope(
      onWillPop: () async => !isMandatory,
      child: Scaffold(
        backgroundColor: AppColors.darkBase,
        body: SafeArea(
          child: Stack(
            children: [
              // Background Gradient Glow
              Positioned(
                top: -80,
                right: -60,
                child: Container(
                  width: 260,
                  height: 260,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.brand.withValues(alpha: 0.18),
                  ),
                ),
              ),
              Positioned(
                bottom: 80,
                left: -80,
                child: Container(
                  width: 240,
                  height: 240,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.amber.withValues(alpha: 0.12),
                  ),
                ),
              ),

              // Main Content ScrollView
              Column(
                children: [
                  // Top App Bar
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        if (!isMandatory && Navigator.canPop(context))
                          IconButton(
                            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
                            onPressed: () => Navigator.pop(context),
                          )
                        else
                          const SizedBox(width: 40),
                        const Text(
                          'App Update',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(width: 40),
                      ],
                    ),
                  ),

                  Expanded(
                    child: SingleChildScrollView(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          const SizedBox(height: 12),

                          // App Icon with Glow
                          Stack(
                            alignment: Alignment.center,
                            children: [
                              Container(
                                width: 104,
                                height: 104,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(28),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.brand.withValues(alpha: 0.45),
                                      blurRadius: 36,
                                      spreadRadius: 2,
                                    ),
                                  ],
                                ),
                              ),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(24),
                                child: Image.asset(
                                  'assets/icons/app_icon.png',
                                  width: 88,
                                  height: 88,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Container(
                                    width: 88,
                                    height: 88,
                                    decoration: BoxDecoration(
                                      gradient: AppColors.brandGradient,
                                      borderRadius: BorderRadius.circular(24),
                                    ),
                                    child: const Icon(
                                      Icons.local_movies_rounded,
                                      color: Colors.white,
                                      size: 44,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 20),

                          // Badge: New Version Available
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.brand.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: AppColors.brand.withValues(alpha: 0.35)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.auto_awesome, color: AppColors.brand, size: 15),
                                const SizedBox(width: 6),
                                Text(
                                  'New Version Available • v$version',
                                  style: const TextStyle(
                                    color: AppColors.brand,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 14),

                          // Title
                          Text(
                            title,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              height: 1.3,
                            ),
                          ),

                          const SizedBox(height: 8),

                          // Subtitle description
                          const Text(
                            'A new and improved version of MovieBuzz is ready with enhanced edge streaming, offline mode, and high-speed downloads.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 13,
                              height: 1.45,
                            ),
                          ),

                          const SizedBox(height: 24),

                          // Version Comparison & APK Info Card
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.darkCard,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: AppColors.darkBorder),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceAround,
                              children: [
                                _buildInfoColumn(
                                  label: 'Current',
                                  value: 'v${ApiConstants.appVersion}',
                                  valueColor: AppColors.textSecondary,
                                ),
                                Container(width: 1, height: 36, color: AppColors.darkBorder),
                                _buildInfoColumn(
                                  label: 'New Version',
                                  value: 'v$version',
                                  valueColor: Colors.greenAccent,
                                ),
                                Container(width: 1, height: 36, color: AppColors.darkBorder),
                                _buildInfoColumn(
                                  label: 'APK Size',
                                  value: apkSize,
                                  valueColor: Colors.amberAccent,
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 20),

                          // Changelog Section
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(18),
                            decoration: BoxDecoration(
                              color: AppColors.darkCard.withValues(alpha: 0.8),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: AppColors.darkBorder),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: const [
                                    Icon(Icons.new_releases_rounded, color: Colors.amberAccent, size: 18),
                                    SizedBox(width: 8),
                                    Text(
                                      "What's New in this Version",
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  changelog,
                                  style: const TextStyle(
                                    color: Color(0xFFE2E8F0),
                                    fontSize: 13,
                                    height: 1.6,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 28),
                        ],
                      ),
                    ),
                  ),

                  // Bottom Action Buttons Area
                  Container(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
                    decoration: BoxDecoration(
                      color: AppColors.darkCard,
                      border: Border(top: BorderSide(color: AppColors.darkBorder.withValues(alpha: 0.7))),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Primary: Open Website Download Page
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton(
                            onPressed: () => _openWebsiteDownload(context),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.brand,
                              foregroundColor: Colors.white,
                              elevation: 8,
                              shadowColor: AppColors.brand.withValues(alpha: 0.4),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Icon(Icons.open_in_browser_rounded, size: 20),
                                SizedBox(width: 10),
                                Text(
                                  'Download on Website',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.2,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                        const SizedBox(height: 10),

                        // Secondary actions: Direct APK Download or Skip
                        Row(
                          children: [
                            Expanded(
                              child: TextButton.icon(
                                onPressed: () => _directDownloadApk(context),
                                icon: const Icon(Icons.download_rounded, size: 16, color: AppColors.textSecondary),
                                label: const Text(
                                  'Direct APK Link',
                                  style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                                ),
                              ),
                            ),
                            if (!isMandatory && Navigator.canPop(context)) ...[
                              Container(width: 1, height: 16, color: AppColors.darkBorder),
                              Expanded(
                                child: TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: const Text(
                                    'Remind Me Later',
                                    style: TextStyle(color: Colors.white54, fontSize: 13),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoColumn({
    required String label,
    required String value,
    required Color valueColor,
  }) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 14,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}
