import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'plugin_registry.dart';

/// Id of the tool the user opened most recently this session.
///
/// Recorded by the router whenever navigation enters a plugin's [basePath];
/// the home hub's Continue card resumes it. Defaults to the first registered
/// plugin until a tool has been visited.
final lastUsedToolIdProvider = StateProvider<String?>((ref) => null);

/// Records [location] as tool usage when it belongs to a registered plugin.
void recordToolVisit(Ref ref, String location) {
  for (final plugin in ref.read(toolPluginsProvider)) {
    if (location == plugin.basePath ||
        location.startsWith('${plugin.basePath}/')) {
      ref.read(lastUsedToolIdProvider.notifier).state = plugin.id;
      return;
    }
  }
}
