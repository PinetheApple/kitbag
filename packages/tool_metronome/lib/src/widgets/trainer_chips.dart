import 'package:core_design/core_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:core_plugin_api/core_plugin_api.dart';

import '../metronome_state.dart';
import 'trainer_sheets.dart';

/// Tempo-ramp trainer chip. While the ramp runs, the label tracks the live
/// BPM straight from the native atomic, polled per vsync — no provider churn.
class RampChip extends ConsumerStatefulWidget {
  const RampChip({super.key, required this.settings});

  final MetronomeSettings settings;

  @override
  ConsumerState<RampChip> createState() => _RampChipState();
}

class _RampChipState extends ConsumerState<RampChip>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  int _liveBpm = 0;

  @override
  void initState() {
    super.initState();
    _liveBpm = ref.read(metronomeControllerProvider).currentBpm.round();
    _ticker = createTicker(_onTick)..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  void _onTick(Duration elapsed) {
    final bpm = ref.read(metronomeControllerProvider).currentBpm.round();
    if (bpm != _liveBpm) {
      setState(() => _liveBpm = bpm);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = widget.settings;
    final label = settings.rampEnabled
        ? 'Ramp $_liveBpm→${settings.ramp.endBpm.round()}'
        : 'Ramp';
    return KitbagChip(
      icon: Icons.trending_up,
      label: label,
      active: settings.rampEnabled,
      onTap: () => showRampSheet(context),
      tooltip: 'Tempo ramp trainer',
    );
  }
}

/// Bar-mute trainer chip. During a muted bar the label flags the silence,
/// polled from the native atomic per vsync.
class MuteBarsChip extends ConsumerStatefulWidget {
  const MuteBarsChip({super.key, required this.settings});

  final MetronomeSettings settings;

  @override
  ConsumerState<MuteBarsChip> createState() => _MuteBarsChipState();
}

class _MuteBarsChipState extends ConsumerState<MuteBarsChip>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  bool _barMuted = false;

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
    final muted = ref.read(metronomeControllerProvider).barMuted;
    if (muted != _barMuted) {
      setState(() => _barMuted = muted);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = widget.settings;
    var label = 'Mute bars';
    if (settings.barMuteEnabled) {
      label = _barMuted
          ? '${settings.barMute.label} · silent'
          : settings.barMute.label;
    }
    return KitbagChip(
      icon: Icons.grid_off,
      label: label,
      active: settings.barMuteEnabled,
      onTap: () => showBarMuteSheet(context),
      tooltip: 'Bar-mute trainer',
    );
  }
}
