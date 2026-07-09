import 'audio_engine.dart';

/// Per-beat accent states, mirroring `kb_accent` in the C API.
enum BeatAccent {
  muted(0),
  normal(1),
  accented(2);

  const BeatAccent(this.code);
  final int code;

  BeatAccent cycled() => switch (this) {
    BeatAccent.accented => BeatAccent.normal,
    BeatAccent.normal => BeatAccent.muted,
    BeatAccent.muted => BeatAccent.accented,
  };
}

/// Control surface for the native metronome sequencer.
///
/// Setters are fire-and-forget commands into the realtime thread; getters
/// read atomic mirrors and are cheap enough to poll every frame.
class MetronomeController {
  MetronomeController(this._engine);

  static const double minBpm = 20;
  static const double maxBpm = 400;
  static const int maxBeats = 16;
  static const int soundCount = 6;
  static const int maxRampBars = 64;
  static const int maxMuteBars = 16;
  static const int maxSubdivision = 16;

  final AudioEngine _engine;

  void start() => _engine.bindings.metronomeStart(_engine.handle);
  void stop() => _engine.bindings.metronomeStop(_engine.handle);

  void setTempo(double bpm) => _engine.bindings.metronomeSetTempo(
    _engine.handle,
    bpm.clamp(minBpm, maxBpm),
  );

  void setBeatsPerBar(int beats) =>
      _engine.bindings.metronomeSetBeats(_engine.handle, beats);

  void setSubdivision(int subdivision) =>
      _engine.bindings.metronomeSetSubdivision(_engine.handle, subdivision);

  void setAccent(int beatIndex, BeatAccent accent) => _engine.bindings
      .metronomeSetAccent(_engine.handle, beatIndex, accent.code);

  void setPolyrhythm({required bool enabled, int beats = 3}) =>
      _engine.bindings.metronomeSetPoly(_engine.handle, enabled ? 1 : 0, beats);

  void setSound(int soundIndex) =>
      _engine.bindings.metronomeSetSound(_engine.handle, soundIndex);

  static const double minVolume = 0;
  static const double maxVolume = 2;
  static const double defaultVolume = 1;

  void setVolume(double volume) => _engine.bindings.metronomeSetVolume(
    _engine.handle,
    volume.clamp(minVolume, maxVolume),
  );

  static const double minLatencyMs = -100;
  static const double maxLatencyMs = 100;
  static const double defaultLatencyMs = 0;

  void setLatencyOffset(double latencyMs) =>
      _engine.bindings.metronomeSetLatencyOffset(
        _engine.handle,
        latencyMs.clamp(minLatencyMs, maxLatencyMs),
      );

  /// Tempo ramp trainer: steps the BPM once per bar from [startBpm] to
  /// [endBpm] over [bars] bars, then holds. [setTempo] cancels it.
  void setRamp({
    required bool enabled,
    double startBpm = 100,
    double endBpm = 140,
    int bars = 8,
  }) => _engine.bindings.metronomeSetRamp(
    _engine.handle,
    enabled ? 1 : 0,
    startBpm,
    endBpm,
    bars,
  );

  /// Bar-mute trainer: cycles [playBars] sounding bars, then [muteBars]
  /// silent bars (all voices), anchored at bar 0.
  void setBarMute({
    required bool enabled,
    int playBars = 3,
    int muteBars = 1,
  }) => _engine.bindings.metronomeSetBarMute(
    _engine.handle,
    enabled ? 1 : 0,
    playBars,
    muteBars,
  );

  bool get isRunning =>
      _engine.bindings.metronomeIsRunning(_engine.handle) != 0;

  /// Beat index within the bar, -1 when stopped.
  int get currentBeat => _engine.bindings.metronomeCurrentBeat(_engine.handle);

  int get currentPolyBeat =>
      _engine.bindings.metronomeCurrentPolyBeat(_engine.handle);

  /// Position within the bar, `[0, 1)`. For beat-sweep UI.
  double get barPhase => _engine.bindings.metronomeBarPhase(_engine.handle);

  /// Effective BPM, including ramp progress. Cheap enough to poll.
  double get currentBpm => _engine.bindings.metronomeCurrentBpm(_engine.handle);

  /// True while the current bar is silenced by the bar-mute trainer.
  bool get barMuted => _engine.bindings.metronomeBarMuted(_engine.handle) != 0;
}
