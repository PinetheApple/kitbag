import 'package:flutter/material.dart';

import 'tokens.dart';

/// Graduated red→green tuning strip with a fixed center line, from the
/// design spec's component library. The needle position carries the signal;
/// color only reinforces it (colorblind-safe by construction).
class KitbagTunerStrip extends StatelessWidget {
  const KitbagTunerStrip({
    super.key,
    required this.cents,
    this.rangeCents = 50,
  });

  /// Needle position in cents off center; null hides the needle (no pitch).
  final double? cents;

  /// Cents from center to either edge of the strip.
  final double rangeCents;

  static const double _height = 56;
  static const double _centerLineOverhang = 6;
  static const double _needleOverhang = 9;
  static const double _needleWidth = 3;
  // Gradient stops per the spec: red → amber 30% → green 47-53% → mirrored.
  static const List<double> _gradientStops = [0, .3, .47, .53, .7, 1];
  static const double _gradientOpacity = .92;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final flat = dark ? KitbagColors.darkFlat : KitbagColors.lightFlat;
    final almost = dark ? KitbagColors.darkAlmost : KitbagColors.lightAlmost;
    final inTune = dark ? KitbagColors.darkInTune : KitbagColors.lightInTune;

    return SizedBox(
      height: _height,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: Opacity(
              opacity: _gradientOpacity,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: LinearGradient(
                    colors: [flat, almost, inTune, inTune, almost, flat],
                    stops: _gradientStops,
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: -_centerLineOverhang,
            bottom: -_centerLineOverhang,
            left: 0,
            right: 0,
            child: Center(child: Container(width: 2, color: scheme.onSurface)),
          ),
          if (cents != null)
            Positioned(
              top: -_needleOverhang,
              bottom: -_needleOverhang,
              left: 0,
              right: 0,
              child: Align(
                alignment: Alignment((cents! / rangeCents).clamp(-1.0, 1.0), 0),
                child: _Needle(color: scheme.onSurface),
              ),
            ),
        ],
      ),
    );
  }
}

class _Needle extends StatelessWidget {
  const _Needle({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(Icons.arrow_drop_down, size: 18, color: color),
        Expanded(
          child: Container(
            width: KitbagTunerStrip._needleWidth,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(2),
              boxShadow: const [
                BoxShadow(color: Colors.black54, blurRadius: 8),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
