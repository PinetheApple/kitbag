import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tool_metronome/tool_metronome.dart';
import 'package:tool_tuner/tool_tuner.dart';

export 'package:core_plugin_api/core_plugin_api.dart' show audioEngineProvider;

/// All registered tools, in default home-tile order.
/// Tools land here as they are built (M1: metronome, M2: tuner, …).
final toolPluginsProvider = Provider<List<ToolPlugin>>(
  (ref) => const [MetronomePlugin(), TunerPlugin()],
);
