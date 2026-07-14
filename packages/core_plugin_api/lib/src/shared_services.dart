import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_db/core_db.dart';
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

/// Tuner control surface — same indirection as the metronome so widget
/// tests can override it with a fake instead of loading the native library.
final tunerControllerProvider = Provider<TunerController>(
  (ref) => ref.watch(audioEngineProvider).tuner,
);

/// Decoder for reading audio file metadata. Not overridable in tests (no
/// fake yet) — guards against missing native library at the call site.
final decoderControllerProvider = Provider<DecoderController>(
  (ref) => ref.watch(audioEngineProvider).decoder,
);

/// The single app database. Widget tests override this with an in-memory
/// executor instead of touching the filesystem.
final kitbagDatabaseProvider = Provider<KitbagDatabase>((ref) {
  final db = KitbagDatabase.open();
  ref.onDispose(db.close);
  return db;
});
