import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_audio_ffi/testing.dart';
import 'package:test/test.dart';

void main() {
  test('setA4 clamps to the 415-466 range like the real controller', () {
    final fake = FakeTunerController();
    fake.setA4(400);
    expect(fake.a4, TunerController.minA4);
    fake.setA4(500);
    expect(fake.a4, TunerController.maxA4);
    fake.setA4(432);
    expect(fake.a4, 432);
  });

  test('failStart throws a device-init failure and stays stopped', () {
    final fake = FakeTunerController()..failStart = true;
    expect(fake.start, throwsA(isA<AudioEngineException>()));
    expect(fake.running, isFalse);
    expect(fake.startCalls, 1);

    fake.failStart = false;
    fake.start();
    expect(fake.running, isTrue);
    expect(fake.startCalls, 2);
  });

  test('read returns the injected reading', () {
    final fake = FakeTunerController();
    expect(fake.read().hasPitch, isFalse);
    fake.reading = const TunerReading(noteIndex: 69, cents: -4, confidence: 1);
    expect(fake.read().noteIndex, 69);
    expect(fake.read().cents, -4);
  });
}
