import 'package:flutter/material.dart';

/// Minimum interactive size for a comfortable touch target (spec §06).
const double _minTapTarget = 48;

/// Small circular secondary action (setlist, trainer slots in transports).
///
/// The visible amber circle is [size], but it rides inside an [IconButton]
/// whose hit target never drops below 48dp — the circle may shrink with
/// layout density, the tappable area may not.
class KitbagCircleButton extends StatelessWidget {
  const KitbagCircleButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.tooltip,
    this.size = 46,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String? tooltip;
  final double size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final enabled = onPressed != null;
    final fg = enabled
        ? scheme.onSurfaceVariant
        : scheme.onSurfaceVariant.withValues(alpha: .38);
    return IconButton(
      onPressed: onPressed,
      tooltip: tooltip,
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(
        minWidth: _minTapTarget,
        minHeight: _minTapTarget,
      ),
      // Pin standard density: the default adaptivePlatformDensity is COMPACT
      // on desktop and would shrink the 48dp floor (its −8,−8 adjustment) to
      // ~40dp — on the very platforms this tool targets.
      style: IconButton.styleFrom(visualDensity: VisualDensity.standard),
      icon: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: scheme.surfaceContainerHighest.withValues(alpha: .6),
          border: Border.all(color: scheme.outline),
        ),
        child: Icon(icon, size: size * .42, color: fg),
      ),
    );
  }
}

/// The primary transport control — accent circle with a soft glow.
class KitbagPlayButton extends StatelessWidget {
  const KitbagPlayButton({
    super.key,
    required this.playing,
    required this.onPressed,
    this.size = 72,
  });

  final bool playing;
  final VoidCallback onPressed;
  final double size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withValues(alpha: .35),
            blurRadius: 24,
            spreadRadius: 2,
          ),
        ],
      ),
      child: SizedBox(
        width: size,
        height: size,
        child: FilledButton(
          onPressed: onPressed,
          style: FilledButton.styleFrom(
            shape: const CircleBorder(),
            padding: EdgeInsets.zero,
          ),
          child: Icon(
            playing ? Icons.stop : Icons.play_arrow,
            size: size * .47,
          ),
        ),
      ),
    );
  }
}
