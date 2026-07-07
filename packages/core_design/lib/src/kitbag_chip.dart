import 'package:flutter/material.dart';

/// Pill chip for modifier rows (trainer modes, click sound, tuner presets).
/// [active] tints it with the accent — the spec's `.chip.on` state.
///
/// The pill stays visually compact but the hit target is at least 48dp in
/// both axes (spec §06 acceptance criterion), like Material's padded tap
/// target on chips.
class KitbagChip extends StatelessWidget {
  const KitbagChip({
    super.key,
    this.icon,
    required this.label,
    this.active = false,
    this.onTap,
    this.tooltip,
  });

  static const double _minTapTarget = 48;

  /// Optional leading icon; the spec's tuner chips are text-only.
  final IconData? icon;
  final String label;
  final bool active;
  final VoidCallback? onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = active ? scheme.primary : scheme.onSurfaceVariant;
    final pill = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(99),
        color: active
            ? Color.alphaBlend(
                scheme.primary.withValues(alpha: .18),
                scheme.surfaceContainerHighest,
              )
            : scheme.surfaceContainerHighest,
        border: Border.all(
          color: active ? scheme.primary.withValues(alpha: .5) : scheme.outline,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: color),
            ),
          ),
        ],
      ),
    );
    final chip = Semantics(
      button: true,
      enabled: onTap != null,
      selected: active,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(_minTapTarget / 2),
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minWidth: _minTapTarget,
            minHeight: _minTapTarget,
          ),
          child: Center(child: pill),
        ),
      ),
    );
    return tooltip == null ? chip : Tooltip(message: tooltip!, child: chip);
  }
}
