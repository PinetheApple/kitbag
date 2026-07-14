import 'dart:async';
import 'dart:typed_data';

import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import 'player_state.dart';

/// Syncs the native metronome to a song's beat grid during playback.
///
/// Strategy: start the metronome's internal sequencer at the first beat,
/// setting BPM to the song's detected tempo. The sample-accurate sequencer
/// stays locked as long as BPM is correct. On seek or tempo deviation, we
/// recompute the alignment.
final beatSyncProvider = Provider<BeatSyncService>((ref) {
  final player = ref.watch(playerProvider);
  final metronome = ref.watch(metronomeControllerProvider);
  final service = BeatSyncService(player, metronome);
  ref.onDispose(service.dispose);
  return service;
});

class BeatSyncService {
  BeatSyncService(this._player, this._metronome);

  final AudioPlayer _player;
  final MetronomeController _metronome;

  List<double> _beatTimes = [];
  double _bpm = 0;
  double _latencyOffsetMs = 0;
  int _nextBeatIndex = 0;
  StreamSubscription<Duration?>? _positionSub;
  bool _active = false;

  /// Load a beat grid and BPM for the current song. Call before [start].
  void loadBeatGrid(Float32List beats, double bpm) {
    _beatTimes = beats.toList();
    _bpm = bpm;
    _nextBeatIndex = 0;
  }

  /// Set output latency offset in ms (positive = click earlier).
  void setLatencyOffset(double offsetMs) {
    _latencyOffsetMs = offsetMs;
  }

  /// Start sync. The metronome is started on the first upcoming beat.
  void start() {
    if (_beatTimes.isEmpty || _bpm <= 0) return;
    _active = true;
    _scheduleNextBeat();
    _positionSub = _player.positionStream.listen(_onPosition);
  }

  /// Stop sync and metronome.
  void stop() {
    _active = false;
    _positionSub?.cancel();
    _positionSub = null;
    _metronome.stop();
  }

  /// Handle a seek — realign to the current position.
  void onSeek(Duration position) {
    if (!_active || _beatTimes.isEmpty) return;
    final posSec = position.inMicroseconds / 1000000.0;
    // Find the next beat after current position
    int i;
    for (i = 0; i < _beatTimes.length; i++) {
      if (_beatTimes[i] >= posSec) break;
    }
    _nextBeatIndex = i;
    _metronome.stop();
    _scheduleNextBeat();
  }

  void dispose() {
    stop();
  }

  void _scheduleNextBeat() {
    if (_nextBeatIndex >= _beatTimes.length) return;

    final pos = _player.position;
    final posSec = pos.inMicroseconds / 1000000.0;
    final nextBeat = _beatTimes[_nextBeatIndex];

    // Apply latency offset: positive = trigger earlier
    final adjustedBeat = nextBeat - (_latencyOffsetMs / 1000.0);
    final delay = (adjustedBeat - posSec).clamp(0.0, 60.0);

    Timer(Duration(milliseconds: (delay * 1000).round()), () {
      if (!_active) return;
      // Set up the metronome for this song
      _metronome.setTempo(_bpm);
      _metronome.start();
      _nextBeatIndex++;
      _scheduleNextBeat();
    });
  }

  void _onPosition(Duration? position) {
    if (!_active || position == null || _beatTimes.isEmpty) return;
    final posSec = position.inMicroseconds / 1000000.0;

    // Auto-advance through beats that were missed
    while (_nextBeatIndex < _beatTimes.length &&
        _beatTimes[_nextBeatIndex] <= posSec - 0.05) {
      _nextBeatIndex++;
    }

    // Periodic re-sync: if the metronome's internal beat doesn't match
    // the beat grid, reset it.
    if (_nextBeatIndex > 0 && _nextBeatIndex < _beatTimes.length) {
      final expectedBeat = _beatTimes[_nextBeatIndex];
      final drift = expectedBeat - posSec;
      if (drift.abs() > 0.1) {
        // Drifted too far — realign
        _metronome.stop();
        _scheduleNextBeat();
      }
    }
  }
}
