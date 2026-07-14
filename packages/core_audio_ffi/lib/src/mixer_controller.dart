import 'dart:ffi';
import 'dart:typed_data';

import 'package:ffi/ffi.dart';

import 'audio_engine.dart';

/// Controls the native N-track stem mixer.
///
/// All methods are non-blocking (atomic writes on the C side). The mixer
/// runs in the realtime audio callback so tracks must be loaded before
/// play() is called.
class MixerController {
  MixerController(this._engine);

  final AudioEngine _engine;

  /// Load PCM data into [track] (0-based index, max 16).
  /// Copies [pcm] into native memory — PCM data is stored inside the C++
  /// mixer so the Dart buffer can be GC'd afterward.
  void setTrackData(int track, Float32List pcm, int channels,
      int sampleRate) {
    final frames = pcm.length ~/ channels;
    final native = calloc<Float>(pcm.length);
    for (int i = 0; i < pcm.length; i++) {
      native[i] = pcm[i];
    }
    _engine.bindings.mixerSetTrackData(
      _engine.handle,
      track,
      native,
      frames,
      channels,
      sampleRate,
    );
    calloc.free(native);
  }

  double getGain(int track) =>
      _engine.bindings.mixerGain(_engine.handle, track);

  void setGain(int track, double gain) =>
      _engine.bindings.mixerSetGain(_engine.handle, track, gain);

  bool getMuted(int track) =>
      _engine.bindings.mixerMuted(_engine.handle, track) != 0;

  void setMuted(int track, bool muted) =>
      _engine.bindings.mixerSetMute(_engine.handle, track, muted ? 1 : 0);

  bool getSoloed(int track) =>
      _engine.bindings.mixerSoloed(_engine.handle, track) != 0;

  void setSoloed(int track, bool soloed) =>
      _engine.bindings.mixerSetSolo(_engine.handle, track, soloed ? 1 : 0);

  void play() => _engine.bindings.mixerPlay(_engine.handle);

  void stop() => _engine.bindings.mixerStop(_engine.handle);

  bool get isPlaying =>
      _engine.bindings.mixerIsPlaying(_engine.handle) != 0;

  void seek(int frame) =>
      _engine.bindings.mixerSeek(_engine.handle, frame);

  int get position =>
      _engine.bindings.mixerPosition(_engine.handle);

  int get activeTrackCount =>
      _engine.bindings.mixerActiveTrackCount(_engine.handle);

  int trackFrames(int track) =>
      _engine.bindings.mixerTrackFrames(_engine.handle, track);
}
