import 'package:core_design/core_design.dart';
import 'package:flutter/material.dart';

import '../metronome_state.dart';
import 'metronome_poll.dart';
import 'trainer_sheets.dart';

/// Tempo-ramp trainer chip. While the ramp runs, the label tracks the live
/// BPM from the native atomic via [MetronomePoll]. [short] drops the word
/// "Ramp" from the active label — the icon carries it on narrow screens.
class RampChip extends StatelessWidget {
  const RampChip({super.key, required this.settings, this.short = false});

  final MetronomeSettings settings;
  final bool short;

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
    final end = settings.ramp.endBpm.round();
    return MetronomePoll<int>(
      active: settings.running,
      idle: settings.ramp.startBpm.round(),
      read: (metronome) => metronome.currentBpm.round(),
      builder: (context, liveBpm) => KitbagChip(
        icon: Icons.trending_up,
        label: short ? '$liveBpm→$end' : 'Ramp $liveBpm→$end',
        active: true,
        onTap: () => showRampSheet(context),
        tooltip: 'Tempo ramp trainer',
      ),
    );
  }
}

/// Bar-mute trainer chip. During a muted bar the label flags the silence,
/// polled from the native atomic via [MetronomePoll]. [short] compresses
/// the labels for narrow screens ('Mute', '3+1', 'silent').
class MuteBarsChip extends StatelessWidget {
  const MuteBarsChip({super.key, required this.settings, this.short = false});

  final MetronomeSettings settings;
  final bool short;

  @override
  Widget build(BuildContext context) {
    if (!settings.barMuteEnabled) {
      return KitbagChip(
        icon: Icons.grid_off,
        label: short ? 'Mute' : 'Mute bars',
        onTap: () => showBarMuteSheet(context),
        tooltip: 'Bar-mute trainer',
      );
    }
    final mute = settings.barMute;
    final cycle = short ? '${mute.playBars}+${mute.muteBars}' : mute.label;
    return MetronomePoll<bool>(
      active: settings.running,
      idle: false,
      read: (metronome) => metronome.barMuted,
      builder: (context, barMuted) => KitbagChip(
        icon: Icons.grid_off,
        label: barMuted ? (short ? 'silent' : '$cycle · silent') : cycle,
        active: true,
        onTap: () => showBarMuteSheet(context),
        tooltip: 'Bar-mute trainer',
      ),
    );
  }
}
