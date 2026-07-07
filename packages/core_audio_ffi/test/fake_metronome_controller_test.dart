import 'package:core_audio_ffi/testing.dart';
import 'package:test/test.dart';

// The fake must honor the documented MetronomeController contract so widget
// tests exercise the same semantics as the native sequencer.
void main() {
  late FakeMetronomeController fake;

  setUp(() => fake = FakeMetronomeController());

  test('setTempo cancels an active ramp', () {
    fake.setRamp(enabled: true);
    fake.setTempo(90);
    expect(fake.rampEnabled, isFalse);
    expect(fake.currentBpm, 90);
  });

  test('currentBpm steps once per bar and holds at the end BPM', () {
    fake.start();
    fake.setRamp(enabled: true, startBpm: 100, endBpm: 200, bars: 4);
    expect(fake.currentBpm, 100);
    fake.simulatedBar = 1;
    expect(fake.currentBpm, 125);
    fake.simulatedBar = 4;
    expect(fake.currentBpm, 200);
    fake.simulatedBar = 40;
    expect(fake.currentBpm, 200, reason: 'holds after the ramp completes');
  });

  test('ramp enabled mid-run progresses from the current bar', () {
    fake.start();
    fake.simulatedBar = 6;
    fake.setRamp(enabled: true, startBpm: 100, endBpm: 140, bars: 8);
    expect(fake.currentBpm, 100);
    fake.simulatedBar = 10;
    expect(fake.currentBpm, 120);
  });

  test('start replays the ramp from its start BPM', () {
    fake.start();
    fake.setRamp(enabled: true, startBpm: 100, endBpm: 200, bars: 4);
    fake.simulatedBar = 4;
    expect(fake.currentBpm, 200);
    fake.start();
    expect(fake.currentBpm, 100);
  });

  test('barMuted plays X bars then mutes Y bars, from bar 0', () {
    fake.start();
    fake.setBarMute(enabled: true, playBars: 3, muteBars: 1);
    final muted = <bool>[];
    for (var bar = 0; bar < 8; bar++) {
      fake.simulatedBar = bar;
      muted.add(fake.barMuted);
    }
    expect(muted, [
      false, false, false, true, // first cycle
      false, false, false, true, // second cycle
    ]);
  });

  test('barMuted is false when stopped or disabled', () {
    fake.setBarMute(enabled: true, playBars: 1, muteBars: 1);
    fake.simulatedBar = 1;
    expect(fake.barMuted, isFalse, reason: 'not running');
    fake.start();
    fake.simulatedBar = 1;
    expect(fake.barMuted, isTrue);
    fake.setBarMute(enabled: false);
    expect(fake.barMuted, isFalse);
  });
}
