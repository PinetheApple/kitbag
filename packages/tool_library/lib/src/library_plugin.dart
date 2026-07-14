import 'package:core_db/core_db.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'library_screen.dart';
import 'library_state.dart';
import 'play_along_screen.dart';
import 'player_screen.dart';

class LibraryPlugin implements ToolPlugin {
  const LibraryPlugin();

  @override
  String get id => 'library';

  @override
  String get name => 'Library';

  @override
  IconData get icon => Icons.library_music;

  @override
  String get basePath => '/library';

  @override
  List<RouteBase> get routes => [
    GoRoute(
      path: 'library',
      builder: (context, state) => const LibraryScreen(),
      routes: [
        GoRoute(
          path: 'player',
          builder: (context, state) {
            final song = state.extra as LibrarySong;
            return PlayerScreen(song: song);
          },
        ),
        GoRoute(
          path: 'play-along',
          builder: (context, state) {
            final song = state.extra as LibrarySong;
            return PlayAlongScreen(song: song);
          },
        ),
      ],
    ),
  ];

  @override
  Widget buildTile(BuildContext context, {required VoidCallback onOpen}) {
    return Consumer(
      builder: (context, ref, _) {
        final count = ref.watch(libraryProvider).songCount;
        return KitbagToolTile(
          icon: icon,
          name: name,
          subtitle: count > 0 ? '$count songs' : 'Import songs',
          onTap: onOpen,
        );
      },
    );
  }
}
