import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import 'setlists_dao.dart';
import 'songs_dao.dart';
import 'tunings_dao.dart';

part 'database.g.dart';

/// A named, ordered collection of song presets.
class Setlists extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get name => text()();
}

/// A metronome preset within a setlist: everything the sequencer needs to
/// recall a song on stage. [accents] stores one `kb_accent` code byte per
/// beat. [position] orders songs within the setlist; only relative order
/// matters, so gaps left by deletions are fine.
class Songs extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get setlistId => integer().customConstraint(
    'NOT NULL REFERENCES setlists (id) ON DELETE CASCADE',
  )();
  IntColumn get position => integer()();
  TextColumn get name => text()();
  RealColumn get bpm => real()();
  IntColumn get beatsPerBar => integer()();
  IntColumn get subdivision => integer()();
  BlobColumn get accents => blob()();
  IntColumn get sound => integer()();
}

/// A saved custom instrument tuning (e.g. drop D): one MIDI note byte per
/// string in [notes], low string first. Built-in presets live in code; only
/// user-defined tunings are stored here.
class Tunings extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get name => text()();
  BlobColumn get notes => blob()();
}

@DriftDatabase(
  tables: [Setlists, Songs, Tunings],
  daos: [SetlistsDao, SongsDao, TuningsDao],
)
class KitbagDatabase extends _$KitbagDatabase {
  /// Tests inject an executor (e.g. `NativeDatabase.memory()`).
  KitbagDatabase(super.e);

  /// The app database, stored in the platform's app-data directory.
  KitbagDatabase.open() : super(driftDatabase(name: 'kitbag'));

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    beforeOpen: (details) async {
      // Required for ON DELETE CASCADE to fire.
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );
}
