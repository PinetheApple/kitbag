import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// Material 3 themes built from the Kitbag tokens.
/// Space Grotesk carries display/numeric roles, Inter carries body text.
abstract final class KitbagTheme {
  static ThemeData dark() => _build(
        brightness: Brightness.dark,
        background: KitbagColors.darkBackground,
        surface: KitbagColors.darkSurface1,
        surfaceHigh: KitbagColors.darkSurface2,
        outline: KitbagColors.darkOutline,
        text: KitbagColors.darkText,
        textDim: KitbagColors.darkTextDim,
        accent: KitbagColors.darkAccent,
        onAccent: KitbagColors.darkOnAccent,
      );

  static ThemeData light() => _build(
        brightness: Brightness.light,
        background: KitbagColors.lightBackground,
        surface: KitbagColors.lightSurface1,
        surfaceHigh: KitbagColors.lightSurface2,
        outline: KitbagColors.lightOutline,
        text: KitbagColors.lightText,
        textDim: KitbagColors.lightTextDim,
        accent: KitbagColors.lightAccent,
        onAccent: KitbagColors.lightOnAccent,
      );

  static ThemeData _build({
    required Brightness brightness,
    required Color background,
    required Color surface,
    required Color surfaceHigh,
    required Color outline,
    required Color text,
    required Color textDim,
    required Color accent,
    required Color onAccent,
  }) {
    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: accent,
      onPrimary: onAccent,
      secondary: accent,
      onSecondary: onAccent,
      error: brightness == Brightness.dark
          ? KitbagColors.darkFlat
          : KitbagColors.lightFlat,
      onError: background,
      surface: surface,
      onSurface: text,
      surfaceContainerHighest: surfaceHigh,
      onSurfaceVariant: textDim,
      outline: outline,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: background,
    );

    final bodyFont = GoogleFonts.interTextTheme(base.textTheme);
    final display = GoogleFonts.spaceGrotesk(
      fontWeight: FontWeight.w700,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    return base.copyWith(
      textTheme: bodyFont.copyWith(
        displayLarge: display.copyWith(fontSize: 88, color: text),
        displayMedium: display.copyWith(fontSize: 56, color: text),
        headlineMedium: GoogleFonts.spaceGrotesk(
          fontWeight: FontWeight.w500,
          fontSize: 22,
          color: text,
        ),
        labelSmall: GoogleFonts.spaceGrotesk(
          fontSize: 12,
          letterSpacing: 2.0,
          color: textDim,
        ),
      ),
    );
  }
}
