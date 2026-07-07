import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'tap_tempo.dart';
import 'trainer.dart';

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
    this.rampEnabled = false,
    this.ramp = const TempoRamp(),
    this.barMuteEnabled = false,
    this.barMute = const BarMute(),
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
  final bool rampEnabled;
  final TempoRamp ramp;
  final bool barMuteEnabled;
  final BarMute barMute;

  MetronomeSettings copyWith({
    double? bpm,
    int? beatsPerBar,
    int? subdivision,
    List<BeatAccent>? accents,
    bool? polyEnabled,
    int? polyBeats,
    int? sound,
    bool? running,
    bool? rampEnabled,
    TempoRamp? ramp,
    bool? barMuteEnabled,
    BarMute? barMute,
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
      rampEnabled: rampEnabled ?? this.rampEnabled,
      ramp: ramp ?? this.ramp,
      barMuteEnabled: barMuteEnabled ?? this.barMuteEnabled,
      barMute: barMute ?? this.barMute,
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
    _pushRamp(settings.rampEnabled, settings.ramp);
    _pushBarMute(settings.barMuteEnabled, settings.barMute);
  }

  void _pushRamp(bool enabled, TempoRamp ramp) => _controller.setRamp(
    enabled: enabled,
    startBpm: ramp.startBpm,
    endBpm: ramp.endBpm,
    bars: ramp.bars,
  );

  void _pushBarMute(bool enabled, BarMute barMute) => _controller.setBarMute(
    enabled: enabled,
    playBars: barMute.playBars,
    muteBars: barMute.muteBars,
  );

  void setBpm(double bpm) {
    final clamped = bpm.clamp(
      MetronomeController.minBpm,
      MetronomeController.maxBpm,
    );
    _controller.setTempo(clamped);
    // A manual tempo change cancels the ramp, mirroring the sequencer.
    state = state.copyWith(bpm: clamped, rampEnabled: false);
  }

  /// Nudges relative to the tempo the user is hearing (and the readout is
  /// showing): during a ramp that is the live ramped BPM, not the dial.
  void nudgeBpm(double delta) {
    final base = state.rampEnabled ? _controller.currentBpm : state.bpm;
    setBpm(base + delta);
  }

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

  void enableRamp(TempoRamp ramp) {
    _pushRamp(true, ramp);
    state = state.copyWith(rampEnabled: true, ramp: ramp);
  }

  void disableRamp() {
    _pushRamp(false, state.ramp);
    _controller.setTempo(state.bpm); // back to the dialed tempo
    state = state.copyWith(rampEnabled: false);
  }

  void enableBarMute(BarMute barMute) {
    _pushBarMute(true, barMute);
    state = state.copyWith(barMuteEnabled: true, barMute: barMute);
  }

  void disableBarMute() {
    _pushBarMute(false, state.barMute);
    state = state.copyWith(barMuteEnabled: false);
  }

  /// Applies a stored song preset in one shot (setlist paging). Keeps the
  /// transport state — paging songs mid-performance must not stop the
  /// click — but, like any manual tempo change, cancels an active ramp.
  void applyPreset({
    required double bpm,
    required int beatsPerBar,
    required int subdivision,
    required List<BeatAccent> accents,
    required int sound,
  }) {
    final padded = [
      ...accents.take(MetronomeController.maxBeats),
      for (var i = accents.length; i < MetronomeController.maxBeats; i++)
        BeatAccent.normal,
    ];
    final settings = state.copyWith(
      bpm: bpm.clamp(MetronomeController.minBpm, MetronomeController.maxBpm),
      beatsPerBar: beatsPerBar.clamp(1, MetronomeController.maxBeats),
      subdivision: subdivision,
      accents: padded,
      sound: sound,
      rampEnabled: false,
    );
    _pushAll(settings);
    state = settings;
  }
}
