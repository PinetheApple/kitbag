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
  bool get isRunning => running;

  @override
  int get currentBeat => running ? 0 : -1;

  @override
  int get currentPolyBeat => -1;

  @override
  double get barPhase => 0;
}
