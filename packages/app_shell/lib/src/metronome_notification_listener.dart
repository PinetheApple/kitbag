import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tool_metronome/tool_metronome.dart';

import 'metronome_notification_service.dart';

/// Listens for metronome running-state changes inside the widget tree and
/// syncs the Android system notification accordingly.
///
/// Must be placed somewhere in the widget tree so [ref.listen] works correctly
/// with the provider lifecycle. Wraps [child] without adding layout.
class MetronomeNotificationListener extends ConsumerWidget {
  const MetronomeNotificationListener({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen<MetronomeSettings>(metronomeProvider, (_, next) {
      MetronomeNotificationService.syncWithState(
        running: next.running,
        bpm: next.bpm.round(),
      );
    });
    return child;
  }
}
