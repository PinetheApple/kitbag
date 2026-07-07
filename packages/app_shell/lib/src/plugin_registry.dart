import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// All registered tools, in default home-tile order.
/// Tools land here as they are built (M1: metronome, M2: tuner, …).
final toolPluginsProvider = Provider<List<ToolPlugin>>((ref) => const []);

/// The single shared native engine. Created lazily, lives for the app.
final audioEngineProvider = Provider<AudioEngine>((ref) {
  final engine = AudioEngine.create()..start();
  ref.onDispose(engine.dispose);
  return engine;
});
