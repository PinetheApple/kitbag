import 'package:flutter_test/flutter_test.dart';
import 'package:tool_metronome/src/trainer.dart';

void main() {
  group('TempoRamp', () {
    const ramp = TempoRamp(startBpm: 100, endBpm: 200, bars: 4);

    test('starts at the start BPM', () {
      expect(ramp.bpmForBar(0), 100);
    });

    test('steps evenly once per bar', () {
      expect(ramp.bpmForBar(1), 125);
      expect(ramp.bpmForBar(2), 150);
      expect(ramp.bpmForBar(3), 175);
      expect(ramp.stepPerBar, 25);
    });

    test('reaches the end BPM after the configured bars and holds', () {
      expect(ramp.bpmForBar(4), 200);
      expect(ramp.bpmForBar(40), 200);
    });

    test('clamps bars before the ramp start', () {
      expect(ramp.bpmForBar(-2), 100);
    });

    test('ramps downward too', () {
      const slowDown = TempoRamp(startBpm: 160, endBpm: 80, bars: 8);
      expect(slowDown.bpmForBar(4), 120);
      expect(slowDown.bpmForBar(8), 80);
      expect(slowDown.stepPerBar, -10);
    });

    test('labels start and end', () {
      expect(ramp.label, 'Ramp 100→200');
    });
  });

  group('BarMute', () {
    test('plays X bars then mutes Y bars, repeating', () {
      const mute = BarMute(playBars: 3, muteBars: 1);
      final muted = [for (var bar = 0; bar < 8; bar++) mute.isMuted(bar)];
      expect(muted, [
        false, false, false, true, // first cycle
        false, false, false, true, // second cycle
      ]);
    });

    test('alternates for play 1, mute 1', () {
      const mute = BarMute(playBars: 1, muteBars: 1);
      expect(mute.isMuted(0), isFalse);
      expect(mute.isMuted(1), isTrue);
      expect(mute.isMuted(2), isFalse);
    });

    test('mutes a longer tail', () {
      const mute = BarMute(playBars: 2, muteBars: 2);
      expect(
        [for (var bar = 0; bar < 4; bar++) mute.isMuted(bar)],
        [false, false, true, true],
      );
    });

    test('labels the cycle', () {
      expect(const BarMute(playBars: 3, muteBars: 1).label, 'Mute 3+1');
    });
  });
}
