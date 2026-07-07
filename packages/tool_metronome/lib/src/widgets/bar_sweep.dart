import 'package:flutter/material.dart';

import 'metronome_poll.dart';

/// Thin bar under the BPM readout sweeping once per bar — the continuous
/// "anticipation" cue; the LED flash is the on-beat confirmation.
class BarSweep extends StatelessWidget {
  const BarSweep({super.key, required this.running});

  final bool running;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return MetronomePoll<double>(
      active: running,
      idle: 0,
      read: (metronome) => metronome.barPhase,
      builder: (context, phase) => SizedBox(
        width: 220,
        height: 3,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(2),
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: phase.clamp(0.0, 1.0),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: scheme.primary,
                  borderRadius: BorderRadius.circular(2),
                ),
                child: const SizedBox(height: 3),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
