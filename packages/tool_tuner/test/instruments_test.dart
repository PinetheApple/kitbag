import 'package:flutter_test/flutter_test.dart';
import 'package:tool_tuner/src/instruments.dart';

void main() {
  group('note math', () {
    test('names MIDI notes in scientific pitch notation', () {
      expect(noteNameForMidi(69), 'A4');
      expect(noteNameForMidi(40), 'E2');
      expect(noteNameForMidi(60), 'C4');
      expect(noteNameForMidi(61), 'C♯4');
    });

    test('frequency follows the A4 reference', () {
      expect(frequencyForMidi(69, 440), closeTo(440, 1e-9));
      expect(frequencyForMidi(57, 440), closeTo(220, 1e-9));
      expect(frequencyForMidi(40, 440), closeTo(82.41, 0.01));
      expect(frequencyForMidi(69, 415), closeTo(415, 1e-9));
    });
  });

  group('auto string detection', () {
    test('snaps a played note to the nearest guitar string', () {
      // G♯3 (56) is 1 semitone from G3 (55), 3 from B3 (59).
      expect(nearestStringIndex(InstrumentPreset.guitar, 56), 3);
      expect(nearestStringIndex(InstrumentPreset.guitar, 40), 0);
      expect(nearestStringIndex(InstrumentPreset.guitar, 70), 5);
    });

    test('handles the reentrant ukulele tuning', () {
      // B4 (71) is nearest the A string (69), not the high-g (67).
      expect(nearestStringIndex(InstrumentPreset.ukulele, 71), 3);
    });
  });

  group('detection bands', () {
    test('string band is narrower than an octave (octave-error kill)', () {
      final string = InstrumentPreset.guitar.strings[0]; // E2
      final band = stringBand(string, 440);
      final center = frequencyForMidi(string.midiNote, 440);
      expect(band.lowHz, greaterThan(center / 2));
      expect(band.highHz, lessThan(center * 2));
      expect(band.lowHz, lessThan(center));
      expect(band.highHz, greaterThan(center));
    });

    test('preset band spans all strings with margin', () {
      final band = presetBand(InstrumentPreset.guitar, 440);
      expect(band.lowHz, lessThan(frequencyForMidi(40, 440)));
      expect(band.highHz, greaterThan(frequencyForMidi(64, 440)));
    });

    test('preset band uses pitch extremes, not string order', () {
      final band = presetBand(InstrumentPreset.ukulele, 440);
      // Lowest pitched ukulele string is C4 (60), not the first peg (g4).
      expect(band.lowHz, lessThan(frequencyForMidi(60, 440)));
      expect(band.lowHz, greaterThan(frequencyForMidi(60 - 6, 440)));
    });

    test('bands scale with the A4 reference', () {
      final at440 = stringBand(InstrumentPreset.guitar.strings[0], 440);
      final at415 = stringBand(InstrumentPreset.guitar.strings[0], 415);
      expect(at415.lowHz, lessThan(at440.lowHz));
      expect(at415.lowHz / at440.lowHz, closeTo(415 / 440, 1e-9));
    });
  });
}
