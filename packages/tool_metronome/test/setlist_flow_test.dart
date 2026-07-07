import 'dart:typed_data';

import 'package:core_audio_ffi/testing.dart';
import 'package:core_db/core_db.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:tool_metronome/src/metronome_routes.dart';
import 'package:tool_metronome/src/metronome_screen.dart';
import 'package:tool_metronome/src/setlist_detail_screen.dart';
import 'package:tool_metronome/src/setlists_screen.dart';
import 'package:tool_metronome/tool_metronome.dart';

void main() {
  late FakeMetronomeController fake;
  late KitbagDatabase db;
  late GoRouter router;

  setUp(() {
    fake = FakeMetronomeController();
    db = KitbagDatabase(NativeDatabase.memory());
  });

  tearDown(() => db.close());

  Widget app() {
    router = GoRouter(
      initialLocation: MetronomeRoutes.metronome,
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const Placeholder(),
          routes: const MetronomePlugin().routes,
        ),
      ],
    );
    return ProviderScope(
      overrides: [
        metronomeControllerProvider.overrideWithValue(fake),
        kitbagDatabaseProvider.overrideWithValue(db),
      ],
      child: MaterialApp.router(routerConfig: router),
    );
  }

  /// Unmounts the app and flushes drift's stream-cleanup timers so the
  /// binding's end-of-test pending-timer check passes.
  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    // Advance the clock so drift's zero-duration cleanup timers fire.
    await tester.pump(const Duration(milliseconds: 1));
  }

  /// Bounded settle: dialogs keep a focused TextField (blinking cursor)
  /// alive, which starves pumpAndSettle.
  Future<void> settle(WidgetTester tester) async {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
  }

  Future<int> seedSong(
    int setlistId,
    String name,
    double bpm, {
    int beatsPerBar = 4,
    int subdivision = 1,
    int sound = 0,
  }) {
    return db.songsDao.append(
      setlistId: setlistId,
      name: name,
      bpm: bpm,
      beatsPerBar: beatsPerBar,
      subdivision: subdivision,
      accents: Uint8List.fromList([2, 1, 1, 1]),
      sound: sound,
    );
  }

  testWidgets('queue button opens the setlists screen, back returns', (
    tester,
  ) async {
    await tester.pumpWidget(app());
    await tester.tap(find.byIcon(Icons.queue_music));
    await settle(tester);
    expect(find.byType(SetlistsScreen), findsOneWidget);
    expect(find.text('Create a setlist'), findsOneWidget);

    await tester.tap(find.byType(BackButton).hitTestable());
    await settle(tester);
    expect(find.byType(MetronomeScreen), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('creates a setlist from the empty-state CTA', (tester) async {
    await tester.pumpWidget(app());
    router.go(MetronomeRoutes.setlists);
    await settle(tester);

    await tester.tap(find.text('Create a setlist'));
    await settle(tester);
    await tester.enterText(find.byType(TextField), 'Wedding set');
    await tester.tap(find.text('Create'));
    await settle(tester);

    expect(find.text('Wedding set'), findsOneWidget);
    expect(find.text('0 songs'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('saves the current metronome settings as a song', (tester) async {
    final setlistId = await db.setlistsDao.create('Wedding set');
    await tester.pumpWidget(app());
    router.go(MetronomeRoutes.setlist(setlistId));
    await settle(tester);

    await tester.tap(find.text('Add current settings'));
    await settle(tester);
    await tester.enterText(find.byType(TextField), 'Opener');
    await tester.tap(find.text('Save'));
    await settle(tester);

    expect(find.text('Opener'), findsOneWidget);
    final song = (await db.songsDao.getBySetlist(setlistId)).single;
    expect(song.bpm, 120);
    expect(song.beatsPerBar, 4);
    expect(song.accents.first, 2);
    await unmount(tester);
  });

  testWidgets('tapping a song applies its preset and starts the session', (
    tester,
  ) async {
    final setlistId = await db.setlistsDao.create('Wedding set');
    await seedSong(
      setlistId,
      'Opener',
      96,
      beatsPerBar: 7,
      subdivision: 2,
      sound: 1,
    );
    await seedSong(setlistId, 'Closer', 140);

    await tester.pumpWidget(app());
    router.go(MetronomeRoutes.setlist(setlistId));
    await settle(tester);

    await tester.tap(find.text('Opener'));
    await settle(tester);

    expect(find.byType(MetronomeScreen), findsOneWidget);
    expect(find.text('96'), findsOneWidget);
    expect(find.text('Wedding set · 1/2'), findsOneWidget);
    expect(fake.tempo, 96);
    expect(fake.beatsPerBar, 7);
    expect(fake.subdivision, 2);
    expect(fake.sound, 1);
    await unmount(tester);
  });

  testWidgets('chip pager pages songs and applies each preset', (tester) async {
    final setlistId = await db.setlistsDao.create('Wedding set');
    await seedSong(setlistId, 'Opener', 96);
    await seedSong(setlistId, 'Closer', 140);

    await tester.pumpWidget(app());
    router.go(MetronomeRoutes.setlist(setlistId));
    await settle(tester);
    await tester.tap(find.text('Opener'));
    await settle(tester);

    await tester.tap(find.byIcon(Icons.chevron_right));
    await settle(tester);
    expect(find.text('Wedding set · 2/2'), findsOneWidget);
    expect(fake.tempo, 140);

    await tester.tap(find.byIcon(Icons.chevron_left));
    await settle(tester);
    expect(find.text('Wedding set · 1/2'), findsOneWidget);
    expect(fake.tempo, 96);
    await unmount(tester);
  });

  testWidgets('reorder persists via drag handles', (tester) async {
    final setlistId = await db.setlistsDao.create('Wedding set');
    await seedSong(setlistId, 'Opener', 96);
    await seedSong(setlistId, 'Closer', 140);

    await tester.pumpWidget(app());
    router.go(MetronomeRoutes.setlist(setlistId));
    await settle(tester);
    expect(find.byType(SetlistDetailScreen), findsOneWidget);

    final handle = find.byIcon(Icons.drag_handle).first;
    final gesture = await tester.startGesture(tester.getCenter(handle));
    await tester.pump(const Duration(milliseconds: 200));
    for (var i = 0; i < 4; i++) {
      await gesture.moveBy(const Offset(0, 50));
      await tester.pump(const Duration(milliseconds: 50));
    }
    await gesture.up();
    await settle(tester);

    final songs = await db.songsDao.getBySetlist(setlistId);
    expect(songs.map((s) => s.name), ['Closer', 'Opener']);
    await unmount(tester);
  });
}
