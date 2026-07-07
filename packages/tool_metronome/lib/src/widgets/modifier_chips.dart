import 'package:core_design/core_design.dart';
import 'package:flutter/material.dart';

import '../format.dart';
import '../metronome_state.dart';
import 'trainer_chips.dart';

/// The Ramp / Mute bars / sound chip row. One horizontal run whenever the
/// chips fit (the mock shows a single row); below [_shortLabelWidth] the
/// labels compress to their short forms so one row survives further, and
/// only genuinely-too-narrow panes wrap — to a second run, never one chip
/// per line.
///
/// The threshold is set so a typical phone's ~320dp inner width uses short
/// labels: full labels put "Mute bars" at ~160dp, which alone overflows a
/// 320dp run and drops a chip to a second line. Above it there is room for
/// the long labels in a single run.
class ModifierChipRow extends StatelessWidget {
  const ModifierChipRow({
    super.key,
    required this.settings,
    required this.notifier,
  });

  static const double _shortLabelWidth = 380;

  final MetronomeSettings settings;
  final MetronomeNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final short = constraints.maxWidth < _shortLabelWidth;
        // runSpacing 4: pills are ~30dp tall inside their 48dp hit target,
        // so adjacent runs keep full targets without doubling the visual gap.
        return Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            RampChip(settings: settings, short: short),
            MuteBarsChip(settings: settings, short: short),
            KitbagChip(
              icon: Icons.notifications_none,
              label: soundNames[settings.sound],
              onTap: () =>
                  notifier.setSound((settings.sound + 1) % soundNames.length),
              tooltip: 'Change click sound',
            ),
          ],
        );
      },
    );
  }
}
