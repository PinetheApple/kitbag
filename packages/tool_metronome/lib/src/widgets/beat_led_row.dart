import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:flutter/material.dart';

import 'metronome_poll.dart';

/// One LED per beat. Tap cycles accent → normal → muted (the row IS the
/// pattern editor). The sounding beat lights up, polled per vsync straight
/// from the native atomics via [MetronomePoll] — no provider churn at 60fps.
class BeatLedRow extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return MetronomePoll<int>(
      active: running,
      idle: -1,
      read: (metronome) =>
          poly ? metronome.currentPolyBeat : metronome.currentBeat,
      builder: (context, activeBeat) => Wrap(
        spacing: 10,
        runSpacing: 10,
        alignment: WrapAlignment.center,
        children: [
          for (var i = 0; i < beatCount; i++)
            GestureDetector(
              onTap: onBeatTap == null ? null : () => onBeatTap!(i),
              child: _Led(
                accent: accents?[i] ?? BeatAccent.normal,
                active: running && i == activeBeat,
                size: size,
                color: scheme.primary,
                idleColor: scheme.surfaceContainerHighest,
                outline: scheme.outline,
              ),
            ),
        ],
      ),
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
