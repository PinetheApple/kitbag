import 'dart:io' show Platform;

import 'package:core_design/core_design.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'metronome_layout.dart';
import 'metronome_routes.dart';
import 'metronome_state.dart';
import 'widgets/bar_sweep.dart';
import 'widgets/metronome_poll.dart';
import 'widgets/modifier_chips.dart';
import 'widgets/pattern_card.dart';
import 'widgets/setlist_chip.dart';

/// The metronome. The whole screen is the tempo control: a raw pointer
/// [Listener] tracks vertical drags (±1 BPM per [_dragPixelsPerBpm] px)
/// without competing with buttons for gestures, and the scroll wheel works
/// on desktop. Presets, TAP and the chevrons are the always-visible twins.
///
/// Responsiveness is planned by [MetronomeLayoutSpec]: whitespace
/// compresses first, then chrome shrinks, wide-short windows regroup into
/// two panes, and only as a last resort does the editing stack scroll —
/// with the transport pinned so play stays reachable mid-practice.
class MetronomeScreen extends ConsumerStatefulWidget {
  const MetronomeScreen({super.key});

  @override
  ConsumerState<MetronomeScreen> createState() => _MetronomeScreenState();
}

class _MetronomeScreenState extends ConsumerState<MetronomeScreen> {
  static const double _dragPixelsPerBpm = 8;
  // A tap must not change tempo: the drag arms only past this distance.
  static const double _armDistance = 14;

  double _dragAccumulated = 0;
  double _dragRemainder = 0;
  bool _dragArmed = false;
  // When part of the screen scrolls, swipe-anywhere yields to scrolling
  // (presets/TAP remain as the visible twins).
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
    final textScale = MediaQuery.textScalerOf(context).scale(14) / 14;

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
          child: LayoutBuilder(
            builder: (context, constraints) {
              final spec = MetronomeLayoutSpec.resolve(
                constraints: constraints,
                textScale: textScale,
                polyRow: settings.polyEnabled,
              );
              _scrollFallback = spec.swipeYieldsToScroll;
              return MetronomeLayout(
                spec: spec,
                readout: _TempoReadout(
                  settings: settings,
                  onNudge: notifier.nudgeBpm,
                  textTheme: theme.textTheme,
                  showChevrons: spec.showChevrons,
                  swipeEnabled: !_scrollFallback,
                ),
                presets: _PresetRow(
                  notifier: notifier,
                  compact: spec.compactControls,
                ),
                pattern: PatternCard(
                  settings: settings,
                  notifier: notifier,
                  density: spec.density,
                ),
                chips: ModifierChipRow(settings: settings, notifier: notifier),
                transport: _Transport(
                  running: settings.running,
                  notifier: notifier,
                  playSize: spec.playSize,
                  circleSize: spec.circleSize,
                ),
              );
            },
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
    required this.showChevrons,
    required this.swipeEnabled,
  });

  final MetronomeSettings settings;
  final ValueChanged<double> onNudge;
  final TextTheme textTheme;

  /// Dense layouts drop the chevrons so the BPM digits keep their size —
  /// presets and swipe/scroll remain as tempo controls.
  final bool showChevrons;

  /// False when a scrolling layout owns vertical drags; the hint then
  /// points at the always-visible controls instead of the gesture.
  final bool swipeEnabled;

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
    final hint = !swipeEnabled
        ? 'TAP · PRESETS'
        : _isDesktop
        ? 'DRAG · SCROLL · ARROWS'
        : 'SWIPE ANYWHERE';
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
              if (showChevrons)
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
              if (showChevrons)
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

class _Transport extends StatelessWidget {
  const _Transport({
    required this.running,
    required this.notifier,
    required this.playSize,
    required this.circleSize,
  });

  final bool running;
  final MetronomeNotifier notifier;
  final double playSize;
  final double circleSize;

  @override
  Widget build(BuildContext context) {
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
          size: playSize,
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
