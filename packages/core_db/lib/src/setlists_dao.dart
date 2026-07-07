import 'package:drift/drift.dart';

import 'database.dart';

part 'setlists_dao.g.dart';

/// A setlist row plus how many songs it holds — what list screens render.
class SetlistSummary {
  const SetlistSummary({required this.setlist, required this.songCount});

  final Setlist setlist;
  final int songCount;
}

@DriftAccessor(tables: [Setlists, Songs])
class SetlistsDao extends DatabaseAccessor<KitbagDatabase>
    with _$SetlistsDaoMixin {
  SetlistsDao(super.db);

  /// All setlists in creation order, each with its song count.
  Stream<List<SetlistSummary>> watchAll() {
    final count = songs.id.count();
    final query =
        select(setlists).join([
            leftOuterJoin(
              songs,
              songs.setlistId.equalsExp(setlists.id),
              useColumns: false,
            ),
          ])
          ..addColumns([count])
          ..groupBy([setlists.id])
          ..orderBy([OrderingTerm.asc(setlists.id)]);
    return query.watch().map(
      (rows) => [
        for (final row in rows)
          SetlistSummary(
            setlist: row.readTable(setlists),
            songCount: row.read(count) ?? 0,
          ),
      ],
    );
  }

  Stream<Setlist> watchSetlist(int id) =>
      (select(setlists)..where((s) => s.id.equals(id))).watchSingle();

  /// Like [watchSetlist] but emits null once the setlist is deleted —
  /// for observers that must outlive it (the active session).
  Stream<Setlist?> watchSetlistOrNull(int id) =>
      (select(setlists)..where((s) => s.id.equals(id))).watchSingleOrNull();

  Future<int> create(String name) =>
      into(setlists).insert(SetlistsCompanion.insert(name: name));

  Future<void> rename(int id, String name) => (update(
    setlists,
  )..where((s) => s.id.equals(id))).write(SetlistsCompanion(name: Value(name)));

  /// Deletes the setlist; its songs cascade away.
  Future<void> deleteSetlist(int id) =>
      (delete(setlists)..where((s) => s.id.equals(id))).go();
}
