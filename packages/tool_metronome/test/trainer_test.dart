import 'package:flutter_test/flutter_test.dart';
import 'package:tool_metronome/src/trainer.dart';

// The schedule math itself lives in the native sequencer (verified by
// tools/metronome_verify.cpp) and in the fake controller contract tests in
// core_audio_ffi; these cover the UI-facing derived values.
void main() {
  group('TempoRamp', () {
    test('stepPerBar divides the climb across the bars', () {
      expect(
        const TempoRamp(startBpm: 100, endBpm: 200, bars: 4).stepPerBar,
        25,
      );
    });

    test('stepPerBar is negative when ramping down', () {
      expect(
        const TempoRamp(startBpm: 160, endBpm: 80, bars: 8).stepPerBar,
        -10,
      );
    });

    test('stepDescription for bars shows per-bar step', () {
      expect(
        const TempoRamp(startBpm: 100, endBpm: 140).stepDescription(),
        '+5.0 BPM per bar',
      );
    });

    test('stepDescription for seconds shows per-second step', () {
      expect(
        const TempoRamp(startBpm: 100, endBpm: 130, bars: 10, unit: RampUnit.seconds)
            .stepDescription(),
        '+3.0 BPM/s over 10 s',
      );
    });

    test('stepDescription for minutes shows per-minute step', () {
      expect(
        const TempoRamp(startBpm: 120, endBpm: 150, bars: 3, unit: RampUnit.minutes)
            .stepDescription(),
        '+10.0 BPM/min over 3 min',
      );
    });

    test('effectiveBars returns bars directly for bar unit', () {
      const ramp = TempoRamp(startBpm: 100, endBpm: 140, bars: 16);
      expect(ramp.effectiveBars(4), 16);
    });

    test('effectiveBars converts seconds to bar count at startBpm', () {
      // 30 seconds at 120 BPM, 4/4: bar = 2s, so 30s = 15 bars
      const ramp = TempoRamp(startBpm: 120, endBpm: 140, bars: 30, unit: RampUnit.seconds);
      expect(ramp.effectiveBars(4), 15);
    });

    test('effectiveBars converts minutes to bar count at startBpm', () {
      // 2 minutes at 120 BPM, 4/4: 2 min = 240 bars
      const ramp = TempoRamp(startBpm: 120, endBpm: 140, bars: 2, unit: RampUnit.minutes);
      expect(ramp.effectiveBars(4), 60);
    });

    test('effectiveBars ceil() ensures at least one bar for very short durations', () {
      const ramp = TempoRamp(startBpm: 60, endBpm: 80, bars: 1, unit: RampUnit.seconds);
      // 1 second at 60 BPM, 4/4: bar = 4s, so 1/4 bar → ceil = 1
      expect(ramp.effectiveBars(4), 1);
    });

    test('default unit is bars', () {
      expect(const TempoRamp().unit, RampUnit.bars);
    });
  });

  group('BarMute', () {
    test('labels the cycle', () {
      expect(const BarMute(playBars: 3, muteBars: 1).label, 'Mute 3+1');
    });

    test('rejects an empty side of the cycle', () {
      expect(() => BarMute(playBars: 0, muteBars: 1), throwsAssertionError);
      expect(() => BarMute(playBars: 1, muteBars: 0), throwsAssertionError);
    });
  });
}
