/// Trainer mode configuration passed to the native sequencer, which owns
/// the schedule math (native/audio_core/src/metronome.cpp). The UI only
/// needs the derived bits below for sheet previews and chip labels.
library;

/// What the user's "Bars" / "Seconds" / "Minutes" selector means.
/// The model reuses [bars] to store the raw value in the chosen unit;
/// conversion to actual bar count happens at push time.
enum RampUnit { bars, seconds, minutes }

/// Steps the BPM once per bar from [startBpm] to [endBpm] over [bars] bars
/// (or the equivalent in seconds/minutes), then holds at [endBpm].
///
/// When [unit] is not `bars`, the [bars] field stores the raw duration value
/// in the chosen unit and the native layer receives a converted bar count.
class TempoRamp {
  const TempoRamp({this.startBpm = 100, this.endBpm = 140, this.bars = 8, this.unit = RampUnit.bars});

  final double startBpm;
  final double endBpm;
  final int bars;
  final RampUnit unit;

  /// Tempo step applied at each bar line. Shown in the config sheet.
  double get stepPerBar => (endBpm - startBpm) / bars;

  /// Human-readable step string for the subtitle, e.g. "+5.0 BPM per bar"
  /// or "+2.0 BPM/s over 30 s".
  String stepDescription() {
    final step = stepPerBar >= 0 ? '+' : '';
    final absStep = stepPerBar.abs().toStringAsFixed(1);
    return switch (unit) {
      RampUnit.bars => '$step$absStep BPM per bar',
      RampUnit.seconds => '$step$absStep BPM/s over $bars s',
      RampUnit.minutes => '$step$absStep BPM/min over $bars min',
    };
  }

  /// Converts this ramp to an actual bar count for the native sequencer.
  /// Time-based units are converted at [startBpm] so the ramp covers the
  /// requested wall-clock duration when the metronome starts at that tempo.
  int effectiveBars(int beatsPerBar) {
    if (unit == RampUnit.bars) return bars;
    final seconds = unit == RampUnit.seconds ? bars.toDouble() : bars * 60.0;
    final count = seconds * startBpm / (beatsPerBar * 60);
    return count.ceil().clamp(1, 256);
  }
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
