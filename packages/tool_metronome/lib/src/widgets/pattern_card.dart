import 'package:core_design/core_design.dart';
import 'package:flutter/material.dart';

import '../format.dart';
import '../metronome_layout.dart';
import '../metronome_state.dart';
import 'beat_led_row.dart';

/// Signature stepper + accent LEDs, optional poly row, and the
/// subdivision/poly segmented control. Padding and row gaps tighten with
/// [density] so the card compresses before anything has to scroll.
class PatternCard extends StatelessWidget {
  const PatternCard({
    super.key,
    required this.settings,
    required this.notifier,
    required this.density,
  });

  final MetronomeSettings settings;
  final MetronomeNotifier notifier;
  final MetronomeDensity density;

  @override
  Widget build(BuildContext context) {
    final gap = SizedBox(height: density.cardRowGap);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: EdgeInsets.all(density.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                KitbagStepperRow.inline(
                  semanticLabel: 'beats per bar',
                  onStep: (delta) =>
                      notifier.setBeatsPerBar(settings.beatsPerBar + delta),
                  child: KitbagBadge(
                    label: timeSignatureLabel(settings.beatsPerBar),
                  ),
                ),
                const Spacer(),
                Flexible(
                  child: BeatLedRow(
                    beatCount: settings.beatsPerBar,
                    accents: settings.accents,
                    running: settings.running,
                    onBeatTap: notifier.cycleAccent,
                  ),
                ),
              ],
            ),
            if (settings.polyEnabled) ...[
              gap,
              Row(
                children: [
                  KitbagStepperRow.inline(
                    semanticLabel: 'polyrhythm beats',
                    onStep: (delta) =>
                        notifier.setPolyBeats(settings.polyBeats + delta),
                    child: KitbagBadge(
                      label: '${settings.polyBeats}:${settings.beatsPerBar}',
                      accent: true,
                    ),
                  ),
                  const Spacer(),
                  Flexible(
                    child: BeatLedRow(
                      beatCount: settings.polyBeats,
                      accents: null,
                      running: settings.running,
                      onBeatTap: null,
                      poly: true,
                      size: 16,
                    ),
                  ),
                ],
              ),
            ],
            gap,
            KitbagSegmented(
              segments: [
                for (final (value, label) in const [
                  (1, '♩'),
                  (2, '♪'),
                  (3, '³'),
                  (4, '♬'),
                ])
                  KitbagSegment(
                    label: label,
                    selected: settings.subdivision == value,
                    onTap: () => notifier.setSubdivision(value),
                  ),
                KitbagSegment(
                  label: 'poly',
                  selected: settings.polyEnabled,
                  accent: true,
                  onTap: notifier.togglePolyrhythm,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
