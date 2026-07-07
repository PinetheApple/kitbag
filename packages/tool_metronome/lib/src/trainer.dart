/// Trainer mode configuration passed to the native sequencer, which owns
/// the schedule math (native/audio_core/src/metronome.cpp). The UI only
/// needs the derived bits below for sheet previews and chip labels.
library;

/// Steps the BPM once per bar from [startBpm] to [endBpm] over [bars] bars,
/// then holds at [endBpm].
class TempoRamp {
  const TempoRamp({this.startBpm = 100, this.endBpm = 140, this.bars = 8})
    : assert(bars >= 1, 'a ramp needs at least one bar');

  final double startBpm;
  final double endBpm;
  final int bars;

  /// Tempo step applied at each bar line. Shown in the config sheet.
  double get stepPerBar => (endBpm - startBpm) / bars;
}

/// Repeating cycle of [playBars] sounding bars followed by [muteBars]
/// silent bars, anchored at bar 0.
class BarMute {
  const BarMute({this.playBars = 3, this.muteBars = 1})
    : assert(playBars >= 1 && muteBars >= 1, 'cycle needs bars on both sides');

  final int playBars;
  final int muteBars;

  /// Chip label for the active trainer, e.g. `Mute 3+1`.
  String get label => 'Mute $playBars+$muteBars';
}
