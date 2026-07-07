import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'tuner_screen.dart';
import 'tuner_state.dart';

class TunerPlugin implements ToolPlugin {
  const TunerPlugin();

  @override
  String get id => 'tuner';

  @override
  String get name => 'Tuner';

  @override
  String get basePath => '/tuner';

  @override
  List<RouteBase> get routes => [
    // Relative: nested under the home route so back navigation works.
    GoRoute(path: 'tuner', builder: (context, state) => const TunerScreen()),
  ];

  @override
  Widget buildTile(BuildContext context, {required VoidCallback onOpen}) {
    return Consumer(
      builder: (context, ref, _) {
        final settings = ref.watch(tunerProvider);
        return KitbagToolTile(
          icon: Icons.music_note,
          name: name,
          subtitle: settings.mode == TunerMode.chromatic
              ? 'Chromatic · ${settings.a4.round()} Hz'
              : settings.preset.label,
          onTap: onOpen,
        );
      },
    );
  }
}
