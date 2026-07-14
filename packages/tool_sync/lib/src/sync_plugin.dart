import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'sync_screen.dart';

class SyncPlugin implements ToolPlugin {
  const SyncPlugin();

  @override
  String get id => 'sync';

  @override
  String get name => 'Media Sync';

  @override
  IconData get icon => Icons.sync;

  @override
  String get basePath => '/sync';

  @override
  List<RouteBase> get routes => [
    GoRoute(
      path: 'sync',
      builder: (context, state) => const SyncScreen(),
    ),
  ];

  @override
  Widget buildTile(BuildContext context, {required VoidCallback onOpen}) {
    return KitbagToolTile(
      icon: icon,
      name: name,
      subtitle: 'Sync metronome to any song',
      onTap: onOpen,
    );
  }
}
