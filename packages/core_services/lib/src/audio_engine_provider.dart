import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final audioEngineProvider = Provider<AudioEngine>((ref) {
  final engine = AudioEngine.create()..start();
  ref.onDispose(engine.dispose);
  return engine;
});

final decoderControllerProvider = Provider<DecoderController>(
  (ref) => ref.watch(audioEngineProvider).decoder,
);
