import 'dart:math' as math;

/// MIDI note number of A4, the reference pitch.
const int midiA4 = 69;

const List<String> _noteNames = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
];

/// Scientific pitch name for a MIDI note number, e.g. 69 → `A4`.
String noteNameForMidi(int midi) => '${_noteNames[midi % 12]}${midi ~/ 12 - 1}';

double frequencyForMidi(int midi, double a4Hz) =>
    a4Hz * math.pow(2, (midi - midiA4) / 12);

/// Index into [InstrumentPreset.strings] of the string closest to a played
/// note — the auto string detection.
int nearestStringIndex(InstrumentPreset preset, int midiNote) {
  var nearest = 0;
  for (var i = 1; i < preset.strings.length; i++) {
    final candidate = (preset.strings[i].midiNote - midiNote).abs();
    final best = (preset.strings[nearest].midiNote - midiNote).abs();
    if (candidate < best) {
      nearest = i;
    }
  }
  return nearest;
}

/// Half-width of a detection band in semitones. Well under an octave, so an
/// octave/harmonic error can never land inside the band (PLAN §3).
const double bandHalfWidthSemitones = 5;

double _semitonesAbove(double frequencyHz, double semitones) =>
    frequencyHz * math.pow(2, semitones / 12);

/// Detection band for one locked string.
({double lowHz, double highHz}) stringBand(TunerString string, double a4Hz) {
  final center = frequencyForMidi(string.midiNote, a4Hz);
  return (
    lowHz: _semitonesAbove(center, -bandHalfWidthSemitones),
    highHz: _semitonesAbove(center, bandHalfWidthSemitones),
  );
}

/// Detection band spanning a whole instrument (auto string detection).
({double lowHz, double highHz}) presetBand(
  InstrumentPreset preset,
  double a4Hz,
) {
  // Min/max over strings: reentrant tunings (ukulele gCEA) aren't sorted.
  final midis = preset.strings.map((string) => string.midiNote);
  final low = frequencyForMidi(midis.reduce(math.min), a4Hz);
  final high = frequencyForMidi(midis.reduce(math.max), a4Hz);
  return (
    lowHz: _semitonesAbove(low, -bandHalfWidthSemitones),
    highHz: _semitonesAbove(high, bandHalfWidthSemitones),
  );
}

/// One tunable string: peg label, string number (1 = thinnest) and target
/// note.
class TunerString {
  const TunerString(this.label, this.number, this.midiNote);

  final String label;
  final int number;
  final int midiNote;
}

class InstrumentPreset {
  const InstrumentPreset({
    required this.id,
    required this.name,
    required this.tuningName,
    required this.strings,
  });

  final String id;
  final String name;
  final String tuningName;

  /// Physical string order (thickest first), matching the headstock pegs.
  final List<TunerString> strings;

  String get label => '$name · $tuningName';

  static const guitar = InstrumentPreset(
    id: 'guitar',
    name: 'Guitar',
    tuningName: 'Standard E',
    strings: [
      TunerString('E', 6, 40),
      TunerString('A', 5, 45),
      TunerString('D', 4, 50),
      TunerString('G', 3, 55),
      TunerString('B', 2, 59),
      TunerString('e', 1, 64),
    ],
  );

  static const bass = InstrumentPreset(
    id: 'bass',
    name: 'Bass',
    tuningName: 'Standard E',
    strings: [
      TunerString('E', 4, 28),
      TunerString('A', 3, 33),
      TunerString('D', 2, 38),
      TunerString('G', 1, 43),
    ],
  );

  static const ukulele = InstrumentPreset(
    id: 'ukulele',
    name: 'Ukulele',
    tuningName: 'Standard C',
    strings: [
      TunerString('g', 4, 67),
      TunerString('C', 3, 60),
      TunerString('E', 2, 64),
      TunerString('A', 1, 69),
    ],
  );

  static const all = [guitar, bass, ukulele];
}
