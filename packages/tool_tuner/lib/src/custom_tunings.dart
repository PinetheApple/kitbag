import 'package:core_db/core_db.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'instruments.dart';

/// Saved custom tunings (drop D, DADGAD, …), live from the database.
final savedTuningsProvider = StreamProvider<List<Tuning>>(
  (ref) => ref.watch(kitbagDatabaseProvider).tuningsDao.watchAll(),
);

/// A stored tuning as a preset: it drives pegs, auto string detection and
/// detection bands exactly like the built-ins. Notes are one MIDI byte per
/// string, low string first (the Tunings table contract).
InstrumentPreset presetFromTuning(Tuning tuning) =>
    presetFromNotes(id: tuning.id, name: tuning.name, notes: tuning.notes);

InstrumentPreset presetFromNotes({
  required int id,
  required String name,
  required List<int> notes,
}) {
  return InstrumentPreset(
    id: 'custom-$id',
    name: name,
    tuningName: 'Custom',
    strings: [
      for (var i = 0; i < notes.length; i++)
        TunerString(noteLetterForMidi(notes[i]), notes.length - i, notes[i]),
    ],
  );
}
