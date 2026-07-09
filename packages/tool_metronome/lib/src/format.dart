import 'package:core_db/core_db.dart';

/// Click sound names, indexed by the native sound id.
const List<String> soundNames = [
  'Beep',
  'Woodblock',
  'Click',
  'Tom',
  'Hi-hat',
  'Cowbell',
];

/// The app's time signatures are quarter-note based throughout; this is
/// the one place that renders the denominator.
String timeSignatureLabel(int beatsPerBar) => '$beatsPerBar/4';

/// One-line song preset summary, e.g. "174 BPM · 7/4 · Woodblock".
String songSummary(Song song) =>
    '${song.bpm.round()} BPM · ${timeSignatureLabel(song.beatsPerBar)} · '
    '${soundNames[song.sound >= 0 && song.sound < soundNames.length ? song.sound : 0]}';

/// Musical note symbol for a subdivision value.
String subdivisionSymbol(int subdivision) => switch (subdivision) {
  1 => '♩',
  2 => '♪',
  3 => '³',
  4 => '♬',
  _ => '×$subdivision',
};
