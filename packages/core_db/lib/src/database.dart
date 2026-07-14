import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import 'library_songs_dao.dart';
import 'practice_dao.dart';
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
  BoolColumn get polyEnabled => boolean()();
  IntColumn get polyBeats => integer()();
  IntColumn get sound => integer()();
  RealColumn get volume => real()();
  RealColumn get latencyOffset => real()();
}

/// A saved custom instrument tuning (e.g. drop D): one MIDI note byte per
/// string in [notes], low string first. Built-in presets live in code; only
/// user-defined tunings are stored here.
class Tunings extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get name => text()();
  BlobColumn get notes => blob()();
}

/// A logged practice session: when it happened, how long it lasted, and
/// optional context (which setlist and songs were used).
class PracticeSessions extends Table {
  IntColumn get id => integer().autoIncrement()();
  DateTimeColumn get startTime => dateTime()();
  IntColumn get durationSeconds => integer()();
  RealColumn get avgBpm => real()();
  IntColumn? get setlistId =>
      integer().nullable().customConstraint('REFERENCES setlists (id) ON DELETE SET NULL')();
  TextColumn? get songsPlayed => text().nullable()();
}

/// An imported audio song in the user's library. [filePath] is relative
/// to the app's base music directory.
class LibrarySongs extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get title => text()();
  TextColumn get artist => text()();
  TextColumn get filePath => text()();
  RealColumn get duration => real()();
  TextColumn get format => text()();
  DateTimeColumn get createdAt => dateTime()();
  /// Beat timestamps as a packed float32 array, one per beat (seconds).
  BlobColumn get beatGrid => blob().nullable()();
  /// Detected BPM from beat analysis, or null.
  RealColumn get bpm => real().nullable()();
  /// Path to the waveform peaks sidecar (.kwav) file, or null.
  TextColumn get waveformPath => text().nullable()();
}

@DriftDatabase(
  tables: [Setlists, Songs, Tunings, PracticeSessions, LibrarySongs],
  daos: [SetlistsDao, SongsDao, TuningsDao, PracticeDao, LibrarySongsDao],
)
class KitbagDatabase extends _$KitbagDatabase {
  /// Tests inject an executor (e.g. `NativeDatabase.memory()`).
  KitbagDatabase(super.e);

  /// The app database, stored in the platform's app-data directory.
  KitbagDatabase.open() : super(driftDatabase(name: 'kitbag'));

  @override
  int get schemaVersion => 5;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    beforeOpen: (details) async {
      // Required for ON DELETE CASCADE to fire.
      await customStatement('PRAGMA foreign_keys = ON');
    },
    onUpgrade: (m, from, to) async {
      if (from < 2) {
        await m.addColumn(songs, songs.volume);
        await m.addColumn(songs, songs.latencyOffset);
      }
      if (from < 3) {
        await m.createTable(practiceSessions);
      }
      if (from < 4) {
        await m.createTable(librarySongs);
      }
      if (from < 5) {
        await m.addColumn(librarySongs, librarySongs.beatGrid);
        await m.addColumn(librarySongs, librarySongs.bpm);
        await m.addColumn(librarySongs, librarySongs.waveformPath);
      }
    },
  );
}
