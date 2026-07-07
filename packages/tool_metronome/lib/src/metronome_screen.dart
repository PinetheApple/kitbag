import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'metronome_state.dart';
import 'widgets/bar_sweep.dart';
import 'widgets/beat_led_row.dart';

/// The metronome. The whole screen is the tempo control: vertical drag
/// changes BPM (±1 per [_dragPixelsPerBpm] px). Visible ±5/±10 presets and
/// TAP are the gesture's always-visible twins.
class MetronomeScreen extends ConsumerStatefulWidget {
  const MetronomeScreen({super.key});

  @override
  ConsumerState<MetronomeScreen> createState() => _MetronomeScreenState();
}

class _MetronomeScreenState extends ConsumerState<MetronomeScreen> {
  static const double _dragPixelsPerBpm = 8;
  double _dragRemainder = 0;

  void _onDragUpdate(DragUpdateDetails details) {
    _dragRemainder -= details.delta.dy;
    final wholeBpm = (_dragRemainder / _dragPixelsPerBpm).truncate();
    if (wholeBpm != 0) {
      _dragRemainder -= wholeBpm * _dragPixelsPerBpm;
      ref.read(metronomeProvider.notifier).nudgeBpm(wholeBpm.toDouble());
      HapticFeedback.selectionClick();
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(metronomeProvider);
    final notifier = ref.read(metronomeProvider.notifier);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Metronome'),
        backgroundColor: Colors.transparent,
      ),
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onVerticalDragUpdate: _onDragUpdate,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              children: [
                Expanded(
                  child: _TempoReadout(
                    bpm: settings.bpm,
                    running: settings.running,
                    textTheme: theme.textTheme,
                  ),
                ),
                _PresetRow(notifier: notifier),
                const SizedBox(height: 18),
                _PatternCard(settings: settings, notifier: notifier),
                const SizedBox(height: 12),
                _SoundRow(settings: settings, notifier: notifier),
                const SizedBox(height: 18),
                _Transport(running: settings.running, notifier: notifier),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TempoReadout extends StatelessWidget {
  const _TempoReadout({
    required this.bpm,
    required this.running,
    required this.textTheme,
  });

  final double bpm;
  final bool running;
  final TextTheme textTheme;

  static String _marking(double bpm) {
    if (bpm < 60) return 'LARGO';
    if (bpm < 76) return 'ADAGIO';
    if (bpm < 108) return 'ANDANTE';
    if (bpm < 120) return 'MODERATO';
    if (bpm < 168) return 'ALLEGRO';
    return 'PRESTO';
  }

  @override
  Widget build(BuildContext context) {
    final dim = Theme.of(context).colorScheme.onSurfaceVariant;
    return Center(
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.keyboard_arrow_up, color: dim),
            Text('${bpm.round()}', style: textTheme.displayLarge),
            Text(
              'BPM · ${_marking(bpm)} · SWIPE ANYWHERE',
              style: textTheme.labelSmall,
            ),
            Icon(Icons.keyboard_arrow_down, color: dim),
            const SizedBox(height: 10),
            BarSweep(running: running),
          ],
        ),
      ),
    );
  }
}

class _PresetRow extends StatelessWidget {
  const _PresetRow({required this.notifier});

  final MetronomeNotifier notifier;

  @override
  Widget build(BuildContext context) {
    Widget preset(String label, double delta) => Expanded(
      child: OutlinedButton(
        onPressed: () => notifier.nudgeBpm(delta),
        child: Text(label),
      ),
    );
    return Row(
      children: [
        preset('−10', -10),
        const SizedBox(width: 8),
        preset('−5', -5),
        const SizedBox(width: 8),
        Expanded(
          flex: 2,
          child: FilledButton.tonal(
            onPressed: notifier.tapTempo,
            child: const Text('TAP'),
          ),
        ),
        const SizedBox(width: 8),
        preset('+5', 5),
        const SizedBox(width: 8),
        preset('+10', 10),
      ],
    );
  }
}

class _PatternCard extends StatelessWidget {
  const _PatternCard({required this.settings, required this.notifier});

  final MetronomeSettings settings;
  final MetronomeNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                _BeatsStepper(settings: settings, notifier: notifier),
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
            const SizedBox(height: 12),
            Row(
              children: [
                FilterChip(
                  label: Text(
                    settings.polyEnabled
                        ? '${settings.polyBeats}:${settings.beatsPerBar}'
                        : 'Poly',
                  ),
                  selected: settings.polyEnabled,
                  onSelected: (_) => notifier.togglePolyrhythm(),
                ),
                if (settings.polyEnabled) ...[
                  IconButton(
                    onPressed: () =>
                        notifier.setPolyBeats(settings.polyBeats - 1),
                    icon: const Icon(Icons.remove),
                    visualDensity: VisualDensity.compact,
                  ),
                  IconButton(
                    onPressed: () =>
                        notifier.setPolyBeats(settings.polyBeats + 1),
                    icon: const Icon(Icons.add),
                    visualDensity: VisualDensity.compact,
                  ),
                  const Spacer(),
                  BeatLedRow(
                    beatCount: settings.polyBeats,
                    accents: null,
                    running: settings.running,
                    onBeatTap: null,
                    poly: true,
                    size: 16,
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 1, label: Text('♩')),
                ButtonSegment(value: 2, label: Text('♪')),
                ButtonSegment(value: 3, label: Text('³')),
                ButtonSegment(value: 4, label: Text('♬')),
              ],
              selected: {settings.subdivision},
              onSelectionChanged: (selection) =>
                  notifier.setSubdivision(selection.first),
              showSelectedIcon: false,
            ),
          ],
        ),
      ),
    );
  }
}

class _BeatsStepper extends StatelessWidget {
  const _BeatsStepper({required this.settings, required this.notifier});

  final MetronomeSettings settings;
  final MetronomeNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          onPressed: () => notifier.setBeatsPerBar(settings.beatsPerBar - 1),
          icon: const Icon(Icons.remove),
        ),
        Text(
          '${settings.beatsPerBar}/4',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        IconButton(
          onPressed: () => notifier.setBeatsPerBar(settings.beatsPerBar + 1),
          icon: const Icon(Icons.add),
        ),
      ],
    );
  }
}

class _SoundRow extends StatelessWidget {
  const _SoundRow({required this.settings, required this.notifier});

  static const List<String> _soundNames = ['Beep', 'Woodblock', 'Click'];

  final MetronomeSettings settings;
  final MetronomeNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: [
        for (var i = 0; i < _soundNames.length; i++)
          ChoiceChip(
            label: Text(_soundNames[i]),
            selected: settings.sound == i,
            onSelected: (_) => notifier.setSound(i),
          ),
      ],
    );
  }
}

class _Transport extends StatelessWidget {
  const _Transport({required this.running, required this.notifier});

  final bool running;
  final MetronomeNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        IconButton.outlined(
          onPressed: null,
          tooltip: 'Setlists — coming with the song library',
          icon: const Icon(Icons.queue_music),
        ),
        SizedBox(
          width: 72,
          height: 72,
          child: FilledButton(
            onPressed: () {
              notifier.toggleRunning();
              HapticFeedback.mediumImpact();
            },
            style: FilledButton.styleFrom(shape: const CircleBorder()),
            child: Icon(running ? Icons.stop : Icons.play_arrow, size: 34),
          ),
        ),
        IconButton.outlined(
          onPressed: null,
          tooltip: 'Trainer modes — coming next',
          icon: const Icon(Icons.trending_up),
        ),
      ],
    );
  }
}
