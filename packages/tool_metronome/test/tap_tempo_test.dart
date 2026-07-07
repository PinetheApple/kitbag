import 'package:flutter_test/flutter_test.dart';
import 'package:tool_metronome/src/tap_tempo.dart';

void main() {
  DateTime at(int milliseconds) =>
      DateTime.fromMillisecondsSinceEpoch(milliseconds);

  test('single tap gives no estimate', () {
    expect(TapTempo().tap(at(0)), isNull);
  });

  test('steady taps at 120 BPM', () {
    final tapTempo = TapTempo();
    double? bpm;
    for (var i = 0; i <= 4; i++) {
      bpm = tapTempo.tap(at(i * 500));
    }
    expect(bpm, closeTo(120, 0.01));
  });

  test('averages over the window', () {
    final tapTempo = TapTempo();
    tapTempo.tap(at(0));
    tapTempo.tap(at(480));
    final bpm = tapTempo.tap(at(1000));
    expect(bpm, closeTo(120, 1));
  });

  test('long pause starts a new burst', () {
    final tapTempo = TapTempo();
    tapTempo.tap(at(0));
    tapTempo.tap(at(500));
    expect(tapTempo.tap(at(10000)), isNull);
    expect(tapTempo.tap(at(10400)), closeTo(150, 0.01));
  });
}
