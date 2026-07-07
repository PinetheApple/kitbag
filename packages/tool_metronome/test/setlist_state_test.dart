import 'dart:typed_data';

import 'package:core_audio_ffi/testing.dart';
import 'package:core_db/core_db.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tool_metronome/src/metronome_state.dart';
import 'package:tool_metronome/src/setlist_state.dart';

void main() {
  late FakeMetronomeController fake;
  late KitbagDatabase db;
  late ProviderContainer container;

  setUp(() {
    fake = FakeMetronomeController();
    db = KitbagDatabase(NativeDatabase.memory());
    container = ProviderContainer(
      overrides: [
        metronomeControllerProvider.overrideWithValue(fake),
        kitbagDatabaseProvider.overrideWithValue(db),
      ],
    );
    addTearDown(container.dispose);
    addTearDown(db.close);
  });

  Future<int> seedSong(int setlistId, String name, double bpm) {
    return db.songsDao.append(
      setlistId: setlistId,
      name: name,
      bpm: bpm,
      beatsPerBar: 4,
      subdivision: 1,
      accents: Uint8List.fromList([2, 1, 1, 1]),
      polyEnabled: false,
      polyBeats: 3,
      sound: 0,
    );
  }

  /// Seeds a setlist, starts a session at [index] and returns the setlist id.
  Future<int> startSession({int index = 0}) async {
    final setlistId = await db.setlistsDao.create('Wedding set');
    await seedSong(setlistId, 'Opener', 96);
    await seedSong(setlistId, 'Closer', 140);
    final setlist = await db.setlistsDao.watchSetlist(setlistId).first;
    final songs = await db.songsDao.getBySetlist(setlistId);
    container
        .read(activeSetlistProvider.notifier)
        .play(setlist: setlist, songs: songs, index: index);
    return setlistId;
  }

  ActiveSetlist? active() => container.read(activeSetlistProvider);

  test('recapture during a session: paging applies the new values', () async {
    final setlistId = await startSession();
    final closer = (await db.songsDao.getBySetlist(setlistId)).last;
    await db.songsDao.updateSong(
      closer.id,
      const SongsCompanion(bpm: Value(180)),
    );
    await pumpEventQueue();

    container.read(activeSetlistProvider.notifier).next();
    expect(fake.tempo, 180);
    expect(active()!.label, 'Closer · 2/2');
  });

  test('deleting the current song clamps the session in place', () async {
    final setlistId = await startSession(index: 1);
    final closer = (await db.songsDao.getBySetlist(setlistId)).last;
    await db.songsDao.deleteSong(closer.id);
    await pumpEventQueue();

    expect(active()!.label, 'Opener · 1/1');
    // What is sounding is untouched until the user pages.
    expect(fake.tempo, 140);
  });

  test('reorder during a session follows the current song by id', () async {
    final setlistId = await startSession();
    await db.songsDao.reorder(setlistId, 0, 1);
    await pumpEventQueue();

    expect(active()!.label, 'Opener · 2/2');
    container.read(activeSetlistProvider.notifier).previous();
    expect(fake.tempo, 140); // Closer, now first.
  });

  test('renaming the setlist updates the session live', () async {
    final setlistId = await startSession();
    await db.setlistsDao.rename(setlistId, 'Reception');
    await pumpEventQueue();

    expect(active()!.setlist.name, 'Reception');
  });

  test('dialing a new tempo persists to the current song', () async {
    final setlistId = await startSession();
    container.read(metronomeProvider.notifier).setBpm(104);
    await Future<void>.delayed(
      ActiveSetlistNotifier.bpmSaveDelay + const Duration(milliseconds: 150),
    );

    final songs = await db.songsDao.getBySetlist(setlistId);
    expect(songs.first.bpm, 104); // Opener updated in place.
    expect(songs.last.bpm, 140); // Closer untouched.
  });

  test('paging songs does not rewrite their stored tempos', () async {
    final setlistId = await startSession();
    container.read(activeSetlistProvider.notifier).next();
    container.read(activeSetlistProvider.notifier).previous();
    await Future<void>.delayed(
      ActiveSetlistNotifier.bpmSaveDelay + const Duration(milliseconds: 150),
    );

    final songs = await db.songsDao.getBySetlist(setlistId);
    expect(songs.map((s) => s.bpm), [96, 140]);
  });

  test('deleting another setlist keeps the session alive', () async {
    await startSession();
    final otherId = await db.setlistsDao.create('Jazz night');
    await pumpEventQueue();
    await db.setlistsDao.deleteSetlist(otherId);
    await pumpEventQueue();

    expect(active(), isNotNull);
    expect(active()!.label, 'Opener · 1/2');
  });

  test('deleting the active setlist ends the session', () async {
    final setlistId = await startSession();
    await db.setlistsDao.deleteSetlist(setlistId);
    await pumpEventQueue();

    expect(active(), isNull);
  });
}
