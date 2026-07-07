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

    test('rejects a zero-bar ramp', () {
      expect(
        () => TempoRamp(startBpm: 100, endBpm: 140, bars: 0),
        throwsAssertionError,
      );
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
