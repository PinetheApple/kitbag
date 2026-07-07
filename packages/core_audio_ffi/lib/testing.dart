/// Test doubles for widget/unit tests that must not load the native library.
library;

import 'core_audio_ffi.dart';

class FakeMetronomeController implements MetronomeController {
  double tempo = 120;
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
  void start() => running = true;

  @override
  void stop() => running = false;

  @override
  void setTempo(double bpm) => tempo = bpm;

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
  double get currentBpm => rampEnabled ? rampStartBpm : tempo;

  @override
  bool get rampActive => rampEnabled && running;

  @override
  bool get barMuted => false;
}
