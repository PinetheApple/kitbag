import 'package:core_db/core_db.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'stems_screen.dart';
import 'stems_set_screen.dart';

class StemsPlugin implements ToolPlugin {
  const StemsPlugin();

  @override
  String get id => 'stems';

  @override
  String get name => 'Stems';

  @override
  IconData get icon => Icons.grid_view;

  @override
  String get basePath => '/stems';

  @override
  List<RouteBase> get routes => [
    GoRoute(
      path: 'stems',
      builder: (context, state) => const StemsScreen(),
      routes: [
        GoRoute(
          path: 'set',
          builder: (context, state) {
            final set = state.extra as StemSet;
            return StemsSetScreen(stemSet: set);
          },
        ),
      ],
    ),
  ];

  @override
  Widget buildTile(BuildContext context, {required VoidCallback onOpen}) {
    return KitbagToolTile(
      icon: icon,
      name: name,
      subtitle: 'Multi-track stems',
      onTap: onOpen,
    );
  }
}
