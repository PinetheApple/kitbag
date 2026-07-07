import 'package:drift/drift.dart';

import 'database.dart';

part 'songs_dao.g.dart';

@DriftAccessor(tables: [Songs])
class SongsDao extends DatabaseAccessor<KitbagDatabase> with _$SongsDaoMixin {
  SongsDao(super.db);

  Stream<List<Song>> watchBySetlist(int setlistId) =>
      (_bySetlist(setlistId)).watch();

  Future<List<Song>> getBySetlist(int setlistId) => _bySetlist(setlistId).get();

  SimpleSelectStatement<$SongsTable, Song> _bySetlist(int setlistId) =>
      select(songs)
        ..where((s) => s.setlistId.equals(setlistId))
        ..orderBy([(s) => OrderingTerm.asc(s.position)]);

  /// Inserts a song at the end of its setlist.
  Future<int> append({
    required int setlistId,
    required String name,
    required double bpm,
    required int beatsPerBar,
    required int subdivision,
    required Uint8List accents,
    required int sound,
  }) {
    return transaction(() async {
      final maxPosition = songs.position.max();
      final query = selectOnly(songs)
        ..addColumns([maxPosition])
        ..where(songs.setlistId.equals(setlistId));
      final current = await query
          .map((row) => row.read(maxPosition))
          .getSingle();
      return into(songs).insert(
        SongsCompanion.insert(
          setlistId: setlistId,
          position: (current ?? -1) + 1,
          name: name,
          bpm: bpm,
          beatsPerBar: beatsPerBar,
          subdivision: subdivision,
          accents: accents,
          sound: sound,
        ),
      );
    });
  }

  Future<void> updateSong(int id, SongsCompanion changes) =>
      (update(songs)..where((s) => s.id.equals(id))).write(changes);

  Future<void> deleteSong(int id) =>
      (delete(songs)..where((s) => s.id.equals(id))).go();

  /// Moves the song at [oldIndex] to [newIndex] (plain list indices) and
  /// rewrites positions so the new order persists.
  Future<void> reorder(int setlistId, int oldIndex, int newIndex) {
    return transaction(() async {
      final ordered = await getBySetlist(setlistId);
      final moved = ordered.removeAt(oldIndex);
      ordered.insert(newIndex, moved);
      await batch((b) {
        for (var i = 0; i < ordered.length; i++) {
          b.update(
            songs,
            SongsCompanion(position: Value(i)),
            where: ($SongsTable s) => s.id.equals(ordered[i].id),
          );
        }
      });
    });
  }
}
