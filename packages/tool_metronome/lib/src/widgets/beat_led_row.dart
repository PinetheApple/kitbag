import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:core_plugin_api/core_plugin_api.dart';

/// One LED per beat. Tap cycles accent → normal → muted (the row IS the
/// pattern editor). The sounding beat lights up, polled on each vsync tick
/// straight from the native atomics — no provider churn at 60fps.
class BeatLedRow extends ConsumerStatefulWidget {
  const BeatLedRow({
    super.key,
    required this.beatCount,
    required this.accents,
    required this.running,
    required this.onBeatTap,
    this.poly = false,
    this.size = 30,
  });

  final int beatCount;
  final List<BeatAccent>? accents;
  final bool running;
  final ValueChanged<int>? onBeatTap;
  final bool poly;
  final double size;

  @override
  ConsumerState<BeatLedRow> createState() => _BeatLedRowState();
}

class _BeatLedRowState extends ConsumerState<BeatLedRow>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  int _activeBeat = -1;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick)..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  void _onTick(Duration elapsed) {
    final metronome = ref.read(metronomeControllerProvider);
    final beat = widget.poly
        ? metronome.currentPolyBeat
        : metronome.currentBeat;
    if (beat != _activeBeat) {
      setState(() => _activeBeat = beat);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      alignment: WrapAlignment.center,
      children: [
        for (var i = 0; i < widget.beatCount; i++)
          GestureDetector(
            onTap: widget.onBeatTap == null ? null : () => widget.onBeatTap!(i),
            child: _Led(
              accent: widget.accents?[i] ?? BeatAccent.normal,
              active: widget.running && i == _activeBeat,
              size: widget.size,
              color: scheme.primary,
              idleColor: scheme.surfaceContainerHighest,
              outline: scheme.outline,
            ),
          ),
      ],
    );
  }
}

class _Led extends StatelessWidget {
  const _Led({
    required this.accent,
    required this.active,
    required this.size,
    required this.color,
    required this.idleColor,
    required this.outline,
  });

  final BeatAccent accent;
  final bool active;
  final double size;
  final Color color;
  final Color idleColor;
  final Color outline;

  @override
  Widget build(BuildContext context) {
    final muted = accent == BeatAccent.muted;
    final accented = accent == BeatAccent.accented;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 60),
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: active ? color : (muted ? Colors.transparent : idleColor),
        border: Border.all(
          color: accented ? color : outline,
          width: accented ? 2.5 : 1.5,
        ),
        boxShadow: active
            ? [BoxShadow(color: color.withValues(alpha: .55), blurRadius: 14)]
            : const [],
      ),
      child: muted && !active
          ? Icon(Icons.remove, size: size * .5, color: outline)
          : null,
    );
  }
}
