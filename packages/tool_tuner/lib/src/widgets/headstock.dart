import 'package:core_design/core_design.dart';
import 'package:flutter/material.dart';

import '../instruments.dart';

/// Row of tuning pegs across the top of the tuner. Tap locks a string
/// (tap again to release); green ring = already brought in tune this
/// session; accent glow = the string being tuned right now.
class Headstock extends StatelessWidget {
  const Headstock({
    super.key,
    required this.preset,
    required this.activeString,
    required this.tunedStrings,
    required this.onPegTap,
  });

  final InstrumentPreset preset;

  /// Locked or auto-detected string index; null when nothing sounds.
  final int? activeString;
  final Set<int> tunedStrings;
  final ValueChanged<int> onPegTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < preset.strings.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 7),
            child: _Peg(
              string: preset.strings[i],
              active: i == activeString,
              done: tunedStrings.contains(i),
              onTap: () => onPegTap(i),
            ),
          ),
      ],
    );
  }
}

class _Peg extends StatelessWidget {
  const _Peg({
    required this.string,
    required this.active,
    required this.done,
    required this.onTap,
  });

  static const double _diameter = 30;

  final TunerString string;
  final bool active;
  final bool done;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final inTune = theme.brightness == Brightness.dark
        ? KitbagColors.darkInTune
        : KitbagColors.lightInTune;
    final ringColor = active
        ? scheme.primary
        : done
        ? inTune
        : scheme.outline;
    final noteColor = active
        ? scheme.primary
        : done
        ? inTune
        : scheme.onSurface;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(_diameter),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            width: _diameter,
            height: _diameter,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: scheme.surfaceContainerHighest,
              border: Border.all(color: ringColor, width: 2),
              boxShadow: active
                  ? [
                      BoxShadow(
                        color: scheme.primary.withValues(alpha: .4),
                        blurRadius: 12,
                      ),
                    ]
                  : const [],
            ),
            child: Text(
              string.label,
              style: theme.textTheme.bodySmall?.copyWith(color: noteColor),
            ),
          ),
          const SizedBox(height: 5),
          Text('${string.number}', style: theme.textTheme.labelSmall),
        ],
      ),
    );
  }
}
