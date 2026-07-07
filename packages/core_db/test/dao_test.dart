import 'package:core_db/core_db.dart';
import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late KitbagDatabase db;

  setUp(() => db = KitbagDatabase(NativeDatabase.memory()));
  tearDown(() => db.close());

  Future<int> appendSong(
    int setlistId,
    String name, {
    double bpm = 120,
    int beatsPerBar = 4,
  }) {
    return db.songsDao.append(
      setlistId: setlistId,
      name: name,
      bpm: bpm,
      beatsPerBar: beatsPerBar,
      subdivision: 1,
      accents: Uint8List.fromList([2, 1, 1, 1]),
      sound: 0,
    );
  }

  group('SetlistsDao', () {
    test('creates and watches setlists with song counts', () async {
      final weddingId = await db.setlistsDao.create('Wedding set');
      await db.setlistsDao.create('Jazz night');
      await appendSong(weddingId, 'Everlong');
      await appendSong(weddingId, 'Redbone');

      final summaries = await db.setlistsDao.watchAll().first;
      expect(summaries, hasLength(2));
      expect(summaries.first.setlist.name, 'Wedding set');
      expect(summaries.first.songCount, 2);
      expect(summaries.last.setlist.name, 'Jazz night');
      expect(summaries.last.songCount, 0);
    });

    test('renames a setlist', () async {
      final id = await db.setlistsDao.create('Wedding set');
      await db.setlistsDao.rename(id, 'Reception set');
      final setlist = await db.setlistsDao.getById(id);
      expect(setlist.name, 'Reception set');
    });

    test('deleting a setlist cascades to its songs', () async {
      final id = await db.setlistsDao.create('Wedding set');
      await appendSong(id, 'Everlong');
      await db.setlistsDao.deleteSetlist(id);

      expect(await db.setlistsDao.watchAll().first, isEmpty);
      expect(await db.songsDao.getBySetlist(id), isEmpty);
    });
  });

  group('SongsDao', () {
    late int setlistId;

    setUp(() async => setlistId = await db.setlistsDao.create('Wedding set'));

    test('append assigns sequential positions', () async {
      await appendSong(setlistId, 'One');
      await appendSong(setlistId, 'Two');
      await appendSong(setlistId, 'Three');

      final songs = await db.songsDao.getBySetlist(setlistId);
      expect(songs.map((s) => s.name), ['One', 'Two', 'Three']);
      expect(songs.map((s) => s.position), [0, 1, 2]);
    });

    test('stores the full preset round-trip', () async {
      final accents = Uint8List.fromList([2, 1, 0, 1, 1, 2, 0]);
      final id = await db.songsDao.append(
        setlistId: setlistId,
        name: 'Take Five',
        bpm: 174,
        beatsPerBar: 7,
        subdivision: 3,
        accents: accents,
        sound: 2,
      );

      final song = (await db.songsDao.getBySetlist(
        setlistId,
      )).singleWhere((s) => s.id == id);
      expect(song.bpm, 174);
      expect(song.beatsPerBar, 7);
      expect(song.subdivision, 3);
      expect(song.accents, accents);
      expect(song.sound, 2);
    });

    test('updateSong writes only the given fields', () async {
      final id = await appendSong(setlistId, 'One', bpm: 120);
      await db.songsDao.updateSong(
        id,
        const SongsCompanion(name: Value('One (fast)'), bpm: Value(140)),
      );

      final song = (await db.songsDao.getBySetlist(setlistId)).single;
      expect(song.name, 'One (fast)');
      expect(song.bpm, 140);
      expect(song.beatsPerBar, 4);
    });

    test('reorder persists the new order', () async {
      await appendSong(setlistId, 'One');
      await appendSong(setlistId, 'Two');
      await appendSong(setlistId, 'Three');

      await db.songsDao.reorder(setlistId, 0, 2);

      final songs = await db.songsDao.getBySetlist(setlistId);
      expect(songs.map((s) => s.name), ['Two', 'Three', 'One']);
    });

    test('ordering survives deletions in the middle', () async {
      await appendSong(setlistId, 'One');
      final twoId = await appendSong(setlistId, 'Two');
      await appendSong(setlistId, 'Three');

      await db.songsDao.deleteSong(twoId);
      await appendSong(setlistId, 'Four');

      final songs = await db.songsDao.getBySetlist(setlistId);
      expect(songs.map((s) => s.name), ['One', 'Three', 'Four']);
    });

    test('positions are scoped per setlist', () async {
      final otherId = await db.setlistsDao.create('Jazz night');
      await appendSong(setlistId, 'One');
      await appendSong(otherId, 'Solo');

      final other = await db.songsDao.getBySetlist(otherId);
      expect(other.single.position, 0);
    });
  });
}
