import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/app_colors.dart';
import '../services/api_service.dart';

class AppUpdateDialog extends StatelessWidget {
  final Map<String, dynamic> updateInfo;

  const AppUpdateDialog({super.key, required this.updateInfo});

  static void show(BuildContext context, Map<String, dynamic> updateInfo) {
    showModalBottomSheet(
      context: context,
      isDismissible: !(updateInfo['isMandatory'] == true),
      enableDrag: !(updateInfo['isMandatory'] == true),
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => AppUpdateDialog(updateInfo: updateInfo),
    );
  }

  Future<void> _launchDownloadUrl(BuildContext context) async {
    final downloadPath = updateInfo['downloadUrl'] as String? ?? '/moviebuzz.apk';
    final apiService = ApiService();

    String fullUrl;
    if (downloadPath.startsWith('http')) {
      fullUrl = downloadPath;
    } else {
      final base = apiService.baseUrl.replaceAll('/api', '');
      fullUrl = '$base$downloadPath';
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
    final version = updateInfo['version'] ?? '2.2.0';
    final title = updateInfo['title'] ?? 'New MovieBuzz Update Available';
    final changelog = updateInfo['changelog'] ?? '';
    final apkSize = updateInfo['apkSize'] ?? '55 MB';
    final isMandatory = updateInfo['isMandatory'] == true;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      decoration: const BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(color: AppColors.darkBorder, width: 1.5),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // App Icon & Header
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Image.asset(
                  'assets/icons/app_icon.png',
                  width: 52,
                  height: 52,
                  errorBuilder: (context, error, stackTrace) => Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: AppColors.brandGradient,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.local_movies_rounded, color: Colors.white, size: 28),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'v$version Available',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: const Color(0xFF10B981).withValues(alpha: 0.35),
                              width: 0.8,
                            ),
                          ),
                          child: const Text(
                            'NEW UPDATE',
                            style: TextStyle(
                              color: Color(0xFF34D399),
                              fontSize: 9.5,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Universal Android APK • $apkSize',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Title
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),

          const SizedBox(height: 10),

          // Changelog Box
          if (changelog.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.darkSurface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.darkBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.auto_awesome, color: AppColors.brand, size: 14),
                      SizedBox(width: 6),
                      Text(
                        "What's New:",
                        style: TextStyle(
                          color: AppColors.brand,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    changelog,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 12,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 20),

          // Primary Update Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: () => _launchDownloadUrl(context),
              icon: const Icon(Icons.download_rounded, color: Colors.white, size: 20),
              label: Text(
                'Install Update v$version ($apkSize)',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brand,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 4,
              ),
            ),
          ),

          if (!isMandatory) ...[
            const SizedBox(height: 8),
            Center(
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text(
                  'Remind Me Later',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12.5),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
