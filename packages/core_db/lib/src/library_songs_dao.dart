import 'package:drift/drift.dart';

import 'database.dart';

part 'library_songs_dao.g.dart';

@DriftAccessor(tables: [LibrarySongs])
class LibrarySongsDao extends DatabaseAccessor<KitbagDatabase>
    with _$LibrarySongsDaoMixin {
  LibrarySongsDao(super.db);

  Future<int> create({
    required String title,
    required String artist,
    required String filePath,
    required double duration,
    required String format,
  }) =>
      into(librarySongs).insert(LibrarySongsCompanion(
        title: Value(title),
        artist: Value(artist),
        filePath: Value(filePath),
        duration: Value(duration),
        format: Value(format),
        createdAt: Value(DateTime.now()),
      ));

  Stream<List<LibrarySong>> watchAll() =>
      (select(librarySongs)..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
          .watch();

  Future<LibrarySong?> getById(int id) =>
      (select(librarySongs)..where((t) => t.id.equals(id))).getSingleOrNull();

  Future<void> deleteSong(int id) =>
      (delete(librarySongs)..where((t) => t.id.equals(id))).go();

  Future<int> getCount() =>
      customSelect('SELECT COUNT(*) FROM library_songs')
          .getSingle()
          .then((r) => r.read<int>('COUNT(*)'));
}
