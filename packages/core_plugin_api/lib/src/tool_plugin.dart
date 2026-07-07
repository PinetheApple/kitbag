import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// A self-contained Kitbag tool (metronome, tuner, …).
///
/// The app shell aggregates registered plugins: it mounts their [routes],
/// renders their home tiles, and — for tools that produce or consume audio —
/// attaches their audio nodes to the shared native engine.
abstract class ToolPlugin {
  /// Stable identifier, used for routing, settings and layout persistence.
  String get id;

  /// Human-readable name shown on the home hub.
  String get name;

  /// Route under which the tool's screens live, e.g. `/metronome`.
  String get basePath;

  /// Routes contributed to the app router. Use paths relative to `/`
  /// (e.g. `metronome`) — the shell nests them under the home route so
  /// back navigation to the hub works everywhere.
  List<RouteBase> get routes;

  /// Compact tile for the home hub. [onOpen] navigates to [basePath].
  Widget buildTile(BuildContext context, {required VoidCallback onOpen});
}
