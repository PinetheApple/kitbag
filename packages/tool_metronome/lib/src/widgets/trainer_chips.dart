import 'package:core_design/core_design.dart';
import 'package:flutter/material.dart';

import '../metronome_state.dart';
import 'metronome_poll.dart';
import 'trainer_sheets.dart';

/// Tempo-ramp trainer chip. While the ramp runs, the label tracks the live
/// BPM from the native atomic via [MetronomePoll].
class RampChip extends StatelessWidget {
  const RampChip({super.key, required this.settings});

  final MetronomeSettings settings;

  @override
  Widget build(BuildContext context) {
    if (!settings.rampEnabled) {
      return KitbagChip(
        icon: Icons.trending_up,
        label: 'Ramp',
        onTap: () => showRampSheet(context),
        tooltip: 'Tempo ramp trainer',
      );
    }
    return MetronomePoll<int>(
      active: settings.running,
      idle: settings.ramp.startBpm.round(),
      read: (metronome) => metronome.currentBpm.round(),
      builder: (context, liveBpm) => KitbagChip(
        icon: Icons.trending_up,
        label: 'Ramp $liveBpm→${settings.ramp.endBpm.round()}',
        active: true,
        onTap: () => showRampSheet(context),
        tooltip: 'Tempo ramp trainer',
      ),
    );
  }
}

/// Bar-mute trainer chip. During a muted bar the label flags the silence,
/// polled from the native atomic via [MetronomePoll].
class MuteBarsChip extends StatelessWidget {
  const MuteBarsChip({super.key, required this.settings});

  final MetronomeSettings settings;

  @override
  Widget build(BuildContext context) {
    if (!settings.barMuteEnabled) {
      return KitbagChip(
        icon: Icons.grid_off,
        label: 'Mute bars',
        onTap: () => showBarMuteSheet(context),
        tooltip: 'Bar-mute trainer',
      );
    }
    return MetronomePoll<bool>(
      active: settings.running,
      idle: false,
      read: (metronome) => metronome.barMuted,
      builder: (context, barMuted) => KitbagChip(
        icon: Icons.grid_off,
        label: barMuted
            ? '${settings.barMute.label} · silent'
            : settings.barMute.label,
        active: true,
        onTap: () => showBarMuteSheet(context),
        tooltip: 'Bar-mute trainer',
      ),
    );
  }
}
