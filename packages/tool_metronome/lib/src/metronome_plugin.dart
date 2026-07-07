import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'metronome_screen.dart';
import 'metronome_state.dart';

class MetronomePlugin implements ToolPlugin {
  const MetronomePlugin();

  @override
  String get id => 'metronome';

  @override
  String get name => 'Metronome';

  @override
  String get basePath => '/metronome';

  @override
  List<RouteBase> get routes => [
    GoRoute(
      path: basePath,
      builder: (context, state) => const MetronomeScreen(),
    ),
  ];

  @override
  Widget buildTile(BuildContext context, {required VoidCallback onOpen}) {
    return Consumer(
      builder: (context, ref, _) {
        final settings = ref.watch(metronomeProvider);
        final theme = Theme.of(context);
        return Card(
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onOpen,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.av_timer, color: theme.colorScheme.primary),
                  const Spacer(),
                  Text(name, style: theme.textTheme.titleMedium),
                  Text(
                    '${settings.bpm.round()} BPM · '
                    '${settings.beatsPerBar}/4'
                    '${settings.running ? ' · playing' : ''}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
