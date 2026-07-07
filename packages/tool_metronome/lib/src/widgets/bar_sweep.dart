import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Thin bar under the BPM readout sweeping once per bar — the continuous
/// "anticipation" cue; the LED flash is the on-beat confirmation.
class BarSweep extends ConsumerStatefulWidget {
  const BarSweep({super.key, required this.running});

  final bool running;

  @override
  ConsumerState<BarSweep> createState() => _BarSweepState();
}

class _BarSweepState extends ConsumerState<BarSweep>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  double _phase = 0;

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
    if (!widget.running) {
      if (_phase != 0) setState(() => _phase = 0);
      return;
    }
    final phase = ref.read(metronomeControllerProvider).barPhase;
    setState(() => _phase = phase);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
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
            widthFactor: _phase.clamp(0.0, 1.0),
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
    );
  }
}
