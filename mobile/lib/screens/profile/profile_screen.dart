import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../constants/app_colors.dart';
import '../../constants/api_constants.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import '../auth/register_screen.dart';
import '../history/history_screen.dart';
import '../watchlist/watchlist_screen.dart';
import '../requests/requests_screen.dart';
import '../downloads/downloads_screen.dart';
import '../../widgets/custom_button.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  void _showServerSettingsDialog(BuildContext context, AuthProvider authProvider) {
    final controller = TextEditingController(text: authProvider.currentBaseUrl);

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: AppColors.darkCard,
              title: const Text('Backend API Server', style: TextStyle(color: Colors.white)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Choose a server preset or enter a custom backend API URL:',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        ActionChip(
                          avatar: const Icon(Icons.cloud_done, size: 16, color: Colors.greenAccent),
                          label: const Text('Live Server (Default)'),
                          backgroundColor: AppColors.darkSurface,
                          labelStyle: const TextStyle(fontSize: 11, color: Colors.white),
                          onPressed: () {
                            setDialogState(() {
                              controller.text = 'https://moviebuzz-4slf.onrender.com/api';
                            });
                          },
                        ),
                        ActionChip(
                          avatar: const Icon(Icons.wifi, size: 16, color: AppColors.brand),
                          label: const Text('PC on Wi-Fi (10.251.45.90)'),
                          backgroundColor: AppColors.darkSurface,
                          labelStyle: const TextStyle(fontSize: 11, color: Colors.white),
                          onPressed: () {
                            setDialogState(() {
                              controller.text = 'http://10.251.45.90:5000/api';
                            });
                          },
                        ),
                        ActionChip(
                          avatar: const Icon(Icons.computer, size: 16, color: Colors.blueAccent),
                          label: const Text('Localhost (PC / Web)'),
                          backgroundColor: AppColors.darkSurface,
                          labelStyle: const TextStyle(fontSize: 11, color: Colors.white),
                          onPressed: () {
                            setDialogState(() {
                              controller.text = 'http://localhost:5000/api';
                            });
                          },
                        ),
                        ActionChip(
                          avatar: const Icon(Icons.phone_android, size: 16, color: Colors.amber),
                          label: const Text('Android Emulator (10.0.2.2)'),
                          backgroundColor: AppColors.darkSurface,
                          labelStyle: const TextStyle(fontSize: 11, color: Colors.white),
                          onPressed: () {
                            setDialogState(() {
                              controller.text = 'http://10.0.2.2:5000/api';
                            });
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: controller,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        labelText: 'API Base URL',
                        hintText: 'https://moviebuzz-qr1i.onrender.com/api',
                        filled: true,
                        fillColor: AppColors.darkSurface,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
                ),
                ElevatedButton(
                  onPressed: () {
                    if (controller.text.trim().isNotEmpty) {
                      authProvider.updateBaseUrl(controller.text.trim());
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Connected to: ${controller.text.trim()}')),
                      );
                    }
                  },
                  child: const Text('Save & Connect'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.user;

    return Scaffold(
      backgroundColor: AppColors.darkBase,
      appBar: AppBar(
        title: const Text('Profile & Settings'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Server Settings',
            onPressed: () => _showServerSettingsDialog(context, authProvider),
          ),
        ],
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // User Header or Guest Banner
            if (user != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.darkCard,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.darkBorder, width: 0.5),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: AppColors.brand,
                      child: Text(
                        user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  user.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              if (user.isPremium) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.gold,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text(
                                    'VIP',
                                    style: TextStyle(
                                      color: Colors.black,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            user.email,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              )
            else
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.darkCard,
                      AppColors.darkHover,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.darkBorder, width: 0.5),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.account_circle_outlined, size: 48, color: AppColors.brand),
                    const SizedBox(height: 10),
                    const Text(
                      'Sign in for the Full Cinema Experience',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Sync your watchlist, save progress across devices, and earn CineCoins as you watch.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: CustomButton(
                            text: 'Sign In',
                            onPressed: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const LoginScreen()),
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: CustomButton(
                            text: 'Register',
                            isOutlined: true,
                            onPressed: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const RegisterScreen()),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 16),

            // CineCoins Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF281E0F), Color(0xFF181512)],
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.gold.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.gold.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.monetization_on, color: AppColors.gold, size: 28),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'CineCoins Rewards',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          user != null
                              ? 'Balance: ${user.cineCoins} coins'
                              : 'Earn coins for every minute watched',
                          style: const TextStyle(
                            color: AppColors.gold,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // Navigation List Items
            _buildSettingsTile(
              icon: Icons.download_for_offline_rounded,
              title: 'Offline Downloads',
              subtitle: 'Watch downloaded movies & episodes without internet',
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const DownloadsScreen()),
                );
              },
            ),

            _buildSettingsTile(
              icon: Icons.history_rounded,
              title: 'Watch History',
              subtitle: 'Continue watching previous titles',
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const HistoryScreen()),
                );
              },
            ),

            _buildSettingsTile(
              icon: Icons.bookmark_border_rounded,
              title: 'My Watchlist & Favorites',
              subtitle: 'Saved movies and web series',
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const WatchlistScreen()),
                );
              },
            ),

            _buildSettingsTile(
              icon: Icons.how_to_vote_outlined,
              title: 'Content Requests Leaderboard',
              subtitle: 'Vote for movies & shows to be added',
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const RequestsScreen()),
                );
              },
            ),

            _buildSettingsTile(
              icon: Icons.dns_outlined,
              title: 'Backend API Server Configuration',
              subtitle: authProvider.currentBaseUrl,
              onTap: () => _showServerSettingsDialog(context, authProvider),
            ),

            _buildSettingsTile(
              icon: Icons.info_outline,
              title: 'About MovieBuzz',
              subtitle: 'Version ${ApiConstants.appVersion} (Cloudflare Edge Edition)',
              onTap: () {
                showAboutDialog(
                  context: context,
                  applicationName: 'MovieBuzz',
                  applicationVersion: ApiConstants.appVersion,
                  applicationLegalese: 'Cinematic streaming client with Cloudflare Edge acceleration',
                );
              },
            ),

            if (user != null) ...[
              const SizedBox(height: 20),
              CustomButton(
                text: 'Sign Out',
                isOutlined: true,
                textColor: Colors.redAccent,
                onPressed: () {
                  authProvider.logout();
                },
              ),
            ],

            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.darkCard,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.darkBorder, width: 0.5),
      ),
      child: ListTile(
        leading: Icon(icon, color: AppColors.brand, size: 24),
        title: Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Text(
          subtitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
        ),
        trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary, size: 18),
        onTap: onTap,
      ),
    );
  }
}
