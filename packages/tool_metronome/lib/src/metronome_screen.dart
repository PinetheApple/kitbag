import 'dart:io' show Platform;

import 'package:core_design/core_design.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'format.dart';
import 'metronome_routes.dart';
import 'metronome_state.dart';
import 'widgets/bar_sweep.dart';
import 'widgets/beat_led_row.dart';
import 'widgets/metronome_poll.dart';
import 'widgets/setlist_chip.dart';
import 'widgets/trainer_chips.dart';

/// The metronome. The whole screen is the tempo control: a raw pointer
/// [Listener] tracks vertical drags (±1 BPM per [_dragPixelsPerBpm] px)
/// without competing with buttons for gestures, and the scroll wheel works
/// on desktop. Presets, TAP and the chevrons are the always-visible twins.
class MetronomeScreen extends ConsumerStatefulWidget {
  const MetronomeScreen({super.key});

  @override
  ConsumerState<MetronomeScreen> createState() => _MetronomeScreenState();
}

class _MetronomeScreenState extends ConsumerState<MetronomeScreen> {
  static const double _dragPixelsPerBpm = 8;
  static const double _maxContentWidth = 480;
  // A tap must not change tempo: the drag arms only past this distance.
  static const double _armDistance = 14;

  // Heights below which the layout tightens, then falls back to scrolling.
  static const double _compactHeight = 620;
  static const double _scrollHeight = 420;

  double _dragAccumulated = 0;
  double _dragRemainder = 0;
  bool _dragArmed = false;
  // When the window is too short even for the compact layout, the body
  // scrolls — and swipe-anywhere yields to scrolling (presets/TAP remain
  // as the visible twins).
  bool _scrollFallback = false;

  void _onPointerDown(PointerDownEvent event) {
    _dragAccumulated = 0;
    _dragRemainder = 0;
    _dragArmed = false;
  }

  void _onPointerMove(PointerMoveEvent event) {
    if (_scrollFallback) {
      return;
    }
    _dragAccumulated -= event.delta.dy;
    if (!_dragArmed) {
      if (_dragAccumulated.abs() < _armDistance) {
        return;
      }
      _dragArmed = true;
      _dragRemainder = _dragAccumulated;
    } else {
      _dragRemainder -= event.delta.dy;
    }
    _applyDrag();
  }

  void _applyDrag() {
    final wholeBpm = (_dragRemainder / _dragPixelsPerBpm).truncate();
    if (wholeBpm != 0) {
      _dragRemainder -= wholeBpm * _dragPixelsPerBpm;
      ref.read(metronomeProvider.notifier).nudgeBpm(wholeBpm.toDouble());
      HapticFeedback.selectionClick();
    }
  }

  void _onPointerSignal(PointerSignalEvent event) {
    if (event is PointerScrollEvent) {
      final direction = event.scrollDelta.dy > 0 ? -1.0 : 1.0;
      ref.read(metronomeProvider.notifier).nudgeBpm(direction);
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
        actions: const [SetlistChip()],
      ),
      body: Listener(
        behavior: HitTestBehavior.opaque,
        onPointerDown: _onPointerDown,
        onPointerMove: _onPointerMove,
        onPointerSignal: _onPointerSignal,
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: _maxContentWidth),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final compact = constraints.maxHeight < _compactHeight;
                    _scrollFallback = constraints.maxHeight < _scrollHeight;
                    final readout = _TempoReadout(
                      settings: settings,
                      onNudge: notifier.nudgeBpm,
                      textTheme: theme.textTheme,
                    );
                    final controls = [
                      _PresetRow(notifier: notifier, compact: compact),
                      SizedBox(height: compact ? 10 : 18),
                      _PatternCard(
                        settings: settings,
                        notifier: notifier,
                        compact: compact,
                      ),
                      SizedBox(height: compact ? 8 : 12),
                      _ModifierChips(settings: settings, notifier: notifier),
                      SizedBox(height: compact ? 10 : 18),
                      _Transport(
                        running: settings.running,
                        notifier: notifier,
                        compact: compact,
                      ),
                      SizedBox(height: compact ? 8 : 12),
                    ];
                    if (_scrollFallback) {
                      return SingleChildScrollView(
                        child: Column(
                          children: [
                            SizedBox(height: 170, child: readout),
                            ...controls,
                          ],
                        ),
                      );
                    }
                    return Column(
                      children: [
                        Expanded(child: readout),
                        ...controls,
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TempoReadout extends StatelessWidget {
  const _TempoReadout({
    required this.settings,
    required this.onNudge,
    required this.textTheme,
  });

  final MetronomeSettings settings;
  final ValueChanged<double> onNudge;
  final TextTheme textTheme;

  static final bool _isDesktop =
      !kIsWeb && (Platform.isLinux || Platform.isMacOS || Platform.isWindows);

  static String _marking(int bpm) {
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
    final hint = _isDesktop ? 'DRAG · SCROLL · ARROWS' : 'SWIPE ANYWHERE';
    // With a ramp armed the readout must show what will actually sound: the
    // live ramped BPM while running, the ramp's start BPM while stopped.
    final idleBpm = settings.rampEnabled
        ? settings.ramp.startBpm
        : settings.bpm;
    return MetronomePoll<int>(
      active: settings.running && settings.rampEnabled,
      idle: idleBpm.round(),
      read: (metronome) => metronome.currentBpm.round(),
      builder: (context, bpm) => Center(
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                onPressed: () => onNudge(1),
                icon: Icon(Icons.keyboard_arrow_up, color: dim),
                tooltip: '+1 BPM',
              ),
              Text('$bpm', style: textTheme.displayLarge),
              Text(
                'BPM · ${_marking(bpm)} · $hint',
                style: textTheme.labelSmall,
              ),
              IconButton(
                onPressed: () => onNudge(-1),
                icon: Icon(Icons.keyboard_arrow_down, color: dim),
                tooltip: '−1 BPM',
              ),
              const SizedBox(height: 6),
              BarSweep(running: settings.running),
            ],
          ),
        ),
      ),
    );
  }
}

class _PresetRow extends StatelessWidget {
  const _PresetRow({required this.notifier, this.compact = false});

  final MetronomeNotifier notifier;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    Widget preset(String label, double delta, {int flex = 1}) => Expanded(
      flex: flex,
      child: KitbagTileButton(
        label: label,
        dense: compact,
        onPressed: () => notifier.nudgeBpm(delta),
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
          child: KitbagTileButton(
            label: 'TAP',
            emphasized: true,
            dense: compact,
            onPressed: notifier.tapTempo,
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
  const _PatternCard({
    required this.settings,
    required this.notifier,
    this.compact = false,
  });

  final MetronomeSettings settings;
  final MetronomeNotifier notifier;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final gap = SizedBox(height: compact ? 8.0 : 12.0);
    return Card(
      margin: compact ? const EdgeInsets.symmetric(horizontal: 4) : null,
      child: Padding(
        padding: EdgeInsets.all(compact ? 10 : 14),
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
                  BeatLedRow(
                    beatCount: settings.polyBeats,
                    accents: null,
                    running: settings.running,
                    onBeatTap: null,
                    poly: true,
                    size: 16,
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

class _ModifierChips extends StatelessWidget {
  const _ModifierChips({required this.settings, required this.notifier});

  final MetronomeSettings settings;
  final MetronomeNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        RampChip(settings: settings),
        MuteBarsChip(settings: settings),
        KitbagChip(
          icon: Icons.notifications_none,
          label: soundNames[settings.sound],
          onTap: () =>
              notifier.setSound((settings.sound + 1) % soundNames.length),
          tooltip: 'Change click sound',
        ),
      ],
    );
  }
}

class _Transport extends StatelessWidget {
  const _Transport({
    required this.running,
    required this.notifier,
    this.compact = false,
  });

  final bool running;
  final MetronomeNotifier notifier;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final circleSize = compact ? 40.0 : 46.0;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        KitbagCircleButton(
          icon: Icons.queue_music,
          onPressed: () => context.go(MetronomeRoutes.setlists),
          tooltip: 'Setlists',
          size: circleSize,
        ),
        KitbagPlayButton(
          playing: running,
          size: compact ? 58 : 72,
          onPressed: () {
            notifier.toggleRunning();
            HapticFeedback.mediumImpact();
          },
        ),
        KitbagCircleButton(
          icon: Icons.timer_outlined,
          onPressed: null,
          tooltip: 'Trainer modes — coming next',
          size: circleSize,
        ),
      ],
    );
  }
}
