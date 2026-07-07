import 'package:flutter/material.dart';

/// Small rounded-rect label, e.g. time signatures and poly ratios.
/// [accent] draws it in the primary color (active state).
class KitbagBadge extends StatelessWidget {
  const KitbagBadge({
    super.key,
    required this.label,
    this.accent = false,
    this.onTap,
  });

  final String label;
  final bool accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = accent ? scheme.primary : scheme.onSurfaceVariant;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: accent
                ? scheme.primary.withValues(alpha: .5)
                : scheme.outline,
          ),
          color: scheme.surfaceContainerHighest.withValues(alpha: .4),
        ),
        child: Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: color, letterSpacing: .8),
        ),
      ),
    );
  }
}

/// Dark tile button used for preset rows (−10 / −5 / TAP / +5 / +10).
class KitbagTileButton extends StatelessWidget {
  const KitbagTileButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.emphasized = false,
  });

  final String label;
  final VoidCallback onPressed;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: scheme.surfaceContainerHighest,
        foregroundColor: scheme.onSurface,
        padding: const EdgeInsets.symmetric(vertical: 14),
        textStyle: TextStyle(
          fontWeight: emphasized ? FontWeight.w700 : FontWeight.w500,
        ),
      ),
      child: Text(label),
    );
  }
}

/// One item in a [KitbagSegmented] row.
class KitbagSegment {
  const KitbagSegment({
    required this.label,
    required this.selected,
    required this.onTap,
    this.accent = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  /// Renders the label in the primary color when selected — used for the
  /// poly toggle segment.
  final bool accent;
}

/// Segmented row matching the design spec: a recessed track with flat
/// tiles. Unlike [SegmentedButton], items are independently controlled so a
/// toggle (poly) can live next to a radio group (subdivision).
class KitbagSegmented extends StatelessWidget {
  const KitbagSegmented({super.key, required this.segments});

  final List<KitbagSegment> segments;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: .5),
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: scheme.outline),
      ),
      child: Row(
        children: [
          for (final segment in segments)
            Expanded(
              child: Material(
                color: segment.selected
                    ? scheme.surfaceContainerHighest
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
                child: InkWell(
                  onTap: segment.onTap,
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      segment.label,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: segment.accent && segment.selected
                            ? scheme.primary
                            : segment.selected
                            ? scheme.onSurface
                            : scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Small circular secondary action (setlist, trainer slots in transports).
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
    return SizedBox(
      width: size,
      height: size,
      child: IconButton(
        onPressed: onPressed,
        tooltip: tooltip,
        icon: Icon(icon, size: size * .42),
        style: IconButton.styleFrom(
          backgroundColor: scheme.surfaceContainerHighest.withValues(alpha: .6),
          foregroundColor: scheme.onSurfaceVariant,
          side: BorderSide(color: scheme.outline),
        ),
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
