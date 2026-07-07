import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The single shared native engine. Created lazily, lives for the app.
/// Tool plugins attach through this — never by opening their own engine.
final audioEngineProvider = Provider<AudioEngine>((ref) {
  final engine = AudioEngine.create()..start();
  ref.onDispose(engine.dispose);
  return engine;
});

/// Metronome control surface. Tools and tests reach the sequencer through
/// this indirection so widget tests can override it with a fake instead of
/// loading the native library.
final metronomeControllerProvider = Provider<MetronomeController>(
  (ref) => ref.watch(audioEngineProvider).metronome,
);
