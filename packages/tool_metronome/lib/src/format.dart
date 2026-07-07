import 'package:core_db/core_db.dart';

/// Click sound names, indexed by the native sound id.
const List<String> soundNames = ['Beep', 'Woodblock', 'Click'];

/// The app's time signatures are quarter-note based throughout; this is
/// the one place that renders the denominator.
String timeSignatureLabel(int beatsPerBar) => '$beatsPerBar/4';

/// One-line song preset summary, e.g. "174 BPM · 7/4 · Woodblock".
String songSummary(Song song) =>
    '${song.bpm.round()} BPM · ${timeSignatureLabel(song.beatsPerBar)} · '
    '${soundNames[song.sound]}';
