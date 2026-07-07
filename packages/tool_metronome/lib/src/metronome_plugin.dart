import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'format.dart';
import 'metronome_screen.dart';
import 'metronome_state.dart';
import 'setlist_detail_screen.dart';
import 'setlists_screen.dart';

class MetronomePlugin implements ToolPlugin {
  const MetronomePlugin();

  @override
  String get id => 'metronome';

  @override
  String get name => 'Metronome';

  @override
  String get basePath => '/metronome';

  @override
  IconData get icon => Icons.av_timer;

  @override
  List<RouteBase> get routes => [
    // Relative: nested under the home route so back navigation works.
    GoRoute(
      path: 'metronome',
      builder: (context, state) => const MetronomeScreen(),
      routes: [
        GoRoute(
          path: 'setlists',
          builder: (context, state) => const SetlistsScreen(),
          routes: [
            GoRoute(
              path: ':setlistId',
              builder: (context, state) => SetlistDetailScreen(
                setlistId: int.parse(state.pathParameters['setlistId']!),
              ),
            ),
          ],
        ),
      ],
    ),
  ];

  @override
  Widget buildTile(BuildContext context, {required VoidCallback onOpen}) {
    return Consumer(
      builder: (context, ref, _) {
        final settings = ref.watch(metronomeProvider);
        return KitbagToolTile(
          icon: icon,
          name: name,
          subtitle:
              '${settings.bpm.round()} BPM · '
              '${timeSignatureLabel(settings.beatsPerBar)}'
              '${settings.running ? ' · playing' : ''}',
          onTap: onOpen,
        );
      },
    );
  }
}
