import 'package:flutter/material.dart';

/// Palette from the interface spec (design/kitbag-ui.html).
/// Dark = "Stage" (primary), light = "Daylight".
abstract final class KitbagColors {
  // Stage (dark).
  static const Color darkBackground = Color(0xFF0E0D10);
  static const Color darkSurface1 = Color(0xFF1A1820);
  static const Color darkSurface2 = Color(0xFF242230);
  static const Color darkSurface3 = Color(0xFF2E2C3A);
  static const Color darkOutline = Color(0xFF33303F);
  static const Color darkText = Color(0xFFECEAF0);
  static const Color darkTextDim = Color(0xFF9B97A8);
  static const Color darkAccent = Color(0xFFFFB347);
  static const Color darkOnAccent = Color(0xFF221600);

  // Daylight (light).
  static const Color lightBackground = Color(0xFFF5F3EE);
  static const Color lightSurface1 = Color(0xFFFFFFFF);
  static const Color lightSurface2 = Color(0xFFECE9E1);
  static const Color lightSurface3 = Color(0xFFE3DFD4);
  static const Color lightOutline = Color(0xFFDCD7CA);
  static const Color lightText = Color(0xFF221F26);
  static const Color lightTextDim = Color(0xFF6E687A);
  static const Color lightAccent = Color(0xFFB26F0E);
  static const Color lightOnAccent = Color(0xFFFFF7EA);

  // Semantic — separate channel from accent, never used for emphasis.
  static const Color darkFlat = Color(0xFFFF5C5C);
  static const Color darkInTune = Color(0xFF4ADE80);
  static const Color lightFlat = Color(0xFFCC4444);
  static const Color lightInTune = Color(0xFF1E8A4F);
}
