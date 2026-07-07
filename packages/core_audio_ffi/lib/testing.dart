/// Test doubles for widget/unit tests that must not load the native library.
library;

import 'core_audio_ffi.dart';

/// Honors the documented [MetronomeController] contract: setTempo cancels
/// the ramp, currentBpm steps once per bar, and bar muting cycles from bar
/// 0. Advance [simulatedBar] in tests to model the sequencer's bar clock.
class FakeMetronomeController implements MetronomeController {
  double tempo = 120;
  int simulatedBar = 0;
  int _rampStartBar = 0;
  int beatsPerBar = 4;
  int subdivision = 1;
  final Map<int, BeatAccent> accents = {};
  bool polyEnabled = false;
  int polyBeats = 3;
  int sound = 0;
  bool running = false;
  bool rampEnabled = false;
  double rampStartBpm = 100;
  double rampEndBpm = 140;
  int rampBars = 8;
  bool barMuteEnabled = false;
  int playBars = 3;
  int muteBars = 1;

  @override
  void start() {
    running = true;
    simulatedBar = 0;
    _rampStartBar = 0;
  }

  @override
  void stop() => running = false;

  @override
  void setTempo(double bpm) {
    tempo = bpm;
    rampEnabled = false; // a manual tempo change cancels the ramp
  }

  @override
  void setBeatsPerBar(int beats) => beatsPerBar = beats;

  @override
  void setSubdivision(int value) => subdivision = value;

  @override
  void setAccent(int beatIndex, BeatAccent accent) =>
      accents[beatIndex] = accent;

  @override
  void setPolyrhythm({required bool enabled, int beats = 3}) {
    polyEnabled = enabled;
    polyBeats = beats;
  }

  @override
  void setSound(int soundIndex) => sound = soundIndex;

  @override
  void setRamp({
    required bool enabled,
    double startBpm = 100,
    double endBpm = 140,
    int bars = 8,
  }) {
    rampEnabled = enabled;
    rampStartBpm = startBpm;
    rampEndBpm = endBpm;
    rampBars = bars;
    if (enabled) {
      _rampStartBar = running ? simulatedBar : 0;
    }
  }

  @override
  void setBarMute({required bool enabled, int playBars = 3, int muteBars = 1}) {
    barMuteEnabled = enabled;
    this.playBars = playBars;
    this.muteBars = muteBars;
  }

  @override
  bool get isRunning => running;

  @override
  int get currentBeat => running ? 0 : -1;

  @override
  int get currentPolyBeat => -1;

  @override
  double get barPhase => 0;

  @override
  double get currentBpm {
    if (!rampEnabled) {
      return tempo;
    }
    final progressed = (simulatedBar - _rampStartBar).clamp(0, rampBars);
    return rampStartBpm + (rampEndBpm - rampStartBpm) * progressed / rampBars;
  }

  @override
  bool get barMuted =>
      running &&
      barMuteEnabled &&
      simulatedBar % (playBars + muteBars) >= playBars;
}

/// Honors the documented [TunerController] contract: setA4 clamps to the
/// 415-466 range and start() can be made to fail via [failStart] so the
/// mic-unavailable UI path is testable.
class FakeTunerController implements TunerController {
  double a4 = TunerController.defaultA4;
  double bandLowHz = TunerController.chromaticLowHz;
  double bandHighHz = TunerController.chromaticHighHz;
  bool running = false;
  int startCalls = 0;

  /// When true, start() throws like a failed device init.
  bool failStart = false;

  /// Reading reported to pollers; tests set this directly.
  TunerReading reading = const TunerReading.none();

  @override
  void start() {
    startCalls++;
    if (failStart) {
      throw AudioEngineException(AudioEngineError.deviceInitFailed);
    }
    running = true;
  }

  @override
  void stop() => running = false;

  @override
  void setA4(double a4Hz) =>
      a4 = a4Hz.clamp(TunerController.minA4, TunerController.maxA4);

  @override
  void setBand(double lowHz, double highHz) {
    bandLowHz = lowHz;
    bandHighHz = highHz;
  }

  @override
  TunerReading read() => reading;
}
