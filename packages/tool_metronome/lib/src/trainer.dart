/// Trainer mode schedules. Pure Dart mirrors of the native sequencer math
/// (native/audio_core/src/metronome.cpp), used for chip labels and sheet
/// previews — and to keep the semantics testable without the engine.
library;

/// Steps the BPM once per bar from [startBpm] to [endBpm] over [bars] bars,
/// then holds at [endBpm].
class TempoRamp {
  const TempoRamp({this.startBpm = 100, this.endBpm = 140, this.bars = 8});

  final double startBpm;
  final double endBpm;
  final int bars;

  /// Effective BPM for the given bar since the ramp started.
  double bpmForBar(int bar) {
    final progressed = bar.clamp(0, bars);
    return startBpm + (endBpm - startBpm) * progressed / bars;
  }

  /// Tempo step applied at each bar line.
  double get stepPerBar => (endBpm - startBpm) / bars;

  String get label => 'Ramp ${startBpm.round()}→${endBpm.round()}';
}

/// Repeating cycle of [playBars] sounding bars followed by [muteBars]
/// silent bars, anchored at bar 0.
class BarMute {
  const BarMute({this.playBars = 3, this.muteBars = 1});

  final int playBars;
  final int muteBars;

  bool isMuted(int bar) => bar % (playBars + muteBars) >= playBars;

  String get label => 'Mute $playBars+$muteBars';
}
