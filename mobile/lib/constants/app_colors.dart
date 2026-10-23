import 'package:flutter/material.dart';

class AppColors {
  // MovieBuzz Signature Brand Palette
  static const Color brand = Color(0xFFE50914);
  static const Color brandDark = Color(0xFF990008);
  static const Color brandLight = Color(0xFFFF3344);
  static const Color brandGlow = Color(0x33E50914);

  // Dark Cinematic Surfaces
  static const Color darkBase = Color(0xFF09090D);
  static const Color darkSurface = Color(0xFF101017);
  static const Color darkCard = Color(0xFF161622);
  static const Color darkCardElevated = Color(0xFF1E1E2E);
  static const Color darkBorder = Color(0xFF262638);
  static const Color darkHover = Color(0xFF2D2D42);

  // Accent & Indicator Colors
  static const Color gold = Color(0xFFF59E0B);
  static const Color green = Color(0xFF10B981);
  static const Color blue = Color(0xFF3B82F6);
  static const Color cyan = Color(0xFF06B6D4);
  static const Color purple = Color(0xFF8B5CF6);

  // Typography
  static const Color textPrimary = Color(0xFFF9FAFB);
  static const Color textSecondary = Color(0xFF9CA3AF);
  static const Color textMuted = Color(0xFF6B7280);

  // Gradients
  static const LinearGradient brandGradient = LinearGradient(
    colors: [Color(0xFFE50914), Color(0xFF990008)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Colors.transparent,
      Color(0x3309090D),
      Color(0xCC09090D),
      Color(0xFF09090D),
    ],
    stops: [0.0, 0.45, 0.75, 1.0],
  );

  static const LinearGradient cardOverlayGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Colors.transparent,
      Color(0x80000000),
      Color(0xF009090D),
    ],
  );

  static const LinearGradient cineCoinsGradient = LinearGradient(
    colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
