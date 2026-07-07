import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'tap_tempo.dart';

class MetronomeSettings {
  const MetronomeSettings({
    this.bpm = 120,
    this.beatsPerBar = 4,
    this.subdivision = 1,
    this.accents = _defaultAccents,
    this.polyEnabled = false,
    this.polyBeats = 3,
    this.sound = 0,
    this.running = false,
  });

  static const List<BeatAccent> _defaultAccents = [
    BeatAccent.accented,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
    BeatAccent.normal,
  ];

  final double bpm;
  final int beatsPerBar;
  final int subdivision;
  final List<BeatAccent> accents;
  final bool polyEnabled;
  final int polyBeats;
  final int sound;
  final bool running;

  MetronomeSettings copyWith({
    double? bpm,
    int? beatsPerBar,
    int? subdivision,
    List<BeatAccent>? accents,
    bool? polyEnabled,
    int? polyBeats,
    int? sound,
    bool? running,
  }) {
    return MetronomeSettings(
      bpm: bpm ?? this.bpm,
      beatsPerBar: beatsPerBar ?? this.beatsPerBar,
      subdivision: subdivision ?? this.subdivision,
      accents: accents ?? this.accents,
      polyEnabled: polyEnabled ?? this.polyEnabled,
      polyBeats: polyBeats ?? this.polyBeats,
      sound: sound ?? this.sound,
      running: running ?? this.running,
    );
  }
}

final metronomeProvider =
    NotifierProvider<MetronomeNotifier, MetronomeSettings>(
      MetronomeNotifier.new,
    );

class MetronomeNotifier extends Notifier<MetronomeSettings> {
  final TapTempo _tapTempo = TapTempo();

  MetronomeController get _controller => ref.read(metronomeControllerProvider);

  @override
  MetronomeSettings build() {
    const settings = MetronomeSettings();
    _pushAll(settings);
    return settings;
  }

  void _pushAll(MetronomeSettings settings) {
    final controller = _controller;
    controller.setTempo(settings.bpm);
    controller.setBeatsPerBar(settings.beatsPerBar);
    controller.setSubdivision(settings.subdivision);
    for (var i = 0; i < settings.accents.length; i++) {
      controller.setAccent(i, settings.accents[i]);
    }
    controller.setPolyrhythm(
      enabled: settings.polyEnabled,
      beats: settings.polyBeats,
    );
    controller.setSound(settings.sound);
  }

  void setBpm(double bpm) {
    final clamped = bpm.clamp(
      MetronomeController.minBpm,
      MetronomeController.maxBpm,
    );
    _controller.setTempo(clamped);
    state = state.copyWith(bpm: clamped);
  }

  void nudgeBpm(double delta) => setBpm(state.bpm + delta);

  void tapTempo() {
    final bpm = _tapTempo.tap();
    if (bpm != null) {
      setBpm(bpm.roundToDouble());
    }
  }

  void toggleRunning() {
    final running = !state.running;
    running ? _controller.start() : _controller.stop();
    state = state.copyWith(running: running);
  }

  void setBeatsPerBar(int beats) {
    final clamped = beats.clamp(1, MetronomeController.maxBeats);
    _controller.setBeatsPerBar(clamped);
    state = state.copyWith(beatsPerBar: clamped);
  }

  void setSubdivision(int subdivision) {
    _controller.setSubdivision(subdivision);
    state = state.copyWith(subdivision: subdivision);
  }

  void cycleAccent(int beatIndex) {
    final accents = [...state.accents];
    accents[beatIndex] = accents[beatIndex].cycled();
    _controller.setAccent(beatIndex, accents[beatIndex]);
    state = state.copyWith(accents: accents);
  }

  void togglePolyrhythm() {
    final enabled = !state.polyEnabled;
    _controller.setPolyrhythm(enabled: enabled, beats: state.polyBeats);
    state = state.copyWith(polyEnabled: enabled);
  }

  void setPolyBeats(int beats) {
    final clamped = beats.clamp(2, MetronomeController.maxBeats);
    _controller.setPolyrhythm(enabled: state.polyEnabled, beats: clamped);
    state = state.copyWith(polyBeats: clamped);
  }

  void setSound(int sound) {
    _controller.setSound(sound);
    state = state.copyWith(sound: sound);
  }
}
