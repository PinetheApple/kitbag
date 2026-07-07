import 'package:core_design/core_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'home_screen.dart';
import 'last_used_tool.dart';
import 'plugin_registry.dart';

class KitbagApp extends ConsumerWidget {
  const KitbagApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Kitbag',
      theme: KitbagTheme.light(),
      darkTheme: KitbagTheme.dark(),
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final plugins = ref.watch(toolPluginsProvider);
  return GoRouter(
    // Redirect never rewrites; it observes navigation so the home hub's
    // Continue card can resume the last tool the user actually opened.
    redirect: (context, state) {
      final location = state.uri.path;
      Future.microtask(() => recordToolVisit(ref, location));
      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const HomeScreen(),
        // Tool routes nest under home so the system back gesture and the
        // app-bar back button both return to the hub.
        routes: [for (final plugin in plugins) ...plugin.routes],
      ),
    ],
  );
});
