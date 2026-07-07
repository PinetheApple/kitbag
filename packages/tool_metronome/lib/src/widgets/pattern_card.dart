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
                _CompactStep(
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
                  _CompactStep(
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

/// Wraps a badge with slim −/+ steppers.
class _CompactStep extends StatelessWidget {
  const _CompactStep({required this.onStep, required this.child});

  final ValueChanged<int> onStep;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final dim = Theme.of(context).colorScheme.onSurfaceVariant;
    Widget step(IconData icon, int delta) => InkWell(
      onTap: () => onStep(delta),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Icon(icon, size: 16, color: dim),
      ),
    );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [step(Icons.remove, -1), child, step(Icons.add, 1)],
    );
  }
}
