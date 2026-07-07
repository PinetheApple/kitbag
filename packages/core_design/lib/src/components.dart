import 'package:flutter/material.dart';

import 'scale_down_label.dart';

/// Minimum interactive size for a comfortable touch target (spec §06).
const double _minTapTarget = 48;

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
    this.dense = false,
  });

  final String label;
  final VoidCallback onPressed;
  final bool emphasized;

  /// Tighter vertical padding for height-constrained layouts.
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: scheme.surfaceContainerHighest,
        foregroundColor: scheme.onSurface,
        padding: EdgeInsets.symmetric(vertical: dense ? 8 : 14),
        textStyle: TextStyle(
          fontWeight: emphasized ? FontWeight.w700 : FontWeight.w500,
        ),
      ),
      // Scale down rather than clip when large text scales meet narrow
      // preset tiles (200% text-scale acceptance criterion).
      child: ScaleDownLabel(label),
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
                  child: Container(
                    // Floor each tile's tap target at 48dp (spec §06).
                    constraints: const BoxConstraints(minHeight: _minTapTarget),
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    // Scale down rather than overflow when 200% text scale
                    // meets a narrow segment.
                    child: ScaleDownLabel(
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

/// List-row card: icon tile + title/subtitle + trailing. Used for the home
/// hub rows, and later library/setlist rows. [highlighted] tints it with
/// the accent (the "Continue" card); [enabled] false mutes it (upcoming
/// features).
class KitbagRowCard extends StatelessWidget {
  const KitbagRowCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.onTap,
    this.highlighted = false,
    this.enabled = true,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool highlighted;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final card = Card(
      color: highlighted
          ? Color.alphaBlend(
              scheme.primary.withValues(alpha: .07),
              scheme.surface,
            )
          : null,
      shape: highlighted
          ? RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: scheme.primary.withValues(alpha: .4)),
            )
          : null,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(11),
                  color: scheme.surfaceContainerHighest,
                  border: Border.all(color: scheme.outline),
                ),
                child: Icon(
                  icon,
                  size: 18,
                  color: highlighted ? scheme.primary : scheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleSmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              ?trailing,
            ],
          ),
        ),
      ),
    );
    return enabled ? card : Opacity(opacity: .55, child: card);
  }
}

/// Square-ish grid tile for the home hub tool grid. [enabled] false mutes
/// it (tools that haven't shipped yet).
class KitbagToolTile extends StatelessWidget {
  const KitbagToolTile({
    super.key,
    required this.icon,
    required this.name,
    required this.subtitle,
    this.onTap,
    this.enabled = true,
  });

  final IconData icon;
  final String name;
  final String subtitle;
  final VoidCallback? onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final tile = Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                icon,
                size: 22,
                color: enabled ? scheme.primary : scheme.onSurfaceVariant,
              ),
              const Spacer(),
              Text(
                name,
                style: theme.textTheme.titleSmall,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                subtitle,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
    return enabled ? tile : Opacity(opacity: .55, child: tile);
  }
}

// The circular transport controls (KitbagCircleButton, KitbagPlayButton) live
// in kitbag_transport_buttons.dart.

/// Empty state as a starting line (experience rule 06): names the reason
/// and puts the next action inline — never a bare "No data".
class KitbagEmptyState extends StatelessWidget {
  const KitbagEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
    this.actionIcon = Icons.add,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;
  final IconData actionIcon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: scheme.onSurfaceVariant),
            const SizedBox(height: 14),
            Text(title, style: theme.textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onAction,
              icon: Icon(actionIcon),
              label: Text(actionLabel),
            ),
          ],
        ),
      ),
    );
  }
}
