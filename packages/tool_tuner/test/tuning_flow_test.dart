import 'dart:typed_data';

import 'package:core_audio_ffi/testing.dart';
import 'package:core_db/core_db.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tool_tuner/src/custom_tunings.dart';
import 'package:tool_tuner/src/instruments.dart';
import 'package:tool_tuner/src/mic_permission.dart';
import 'package:tool_tuner/src/tuner_screen.dart';

void main() {
  late FakeTunerController fake;
  late KitbagDatabase db;

  setUp(() {
    fake = FakeTunerController();
    db = KitbagDatabase(NativeDatabase.memory());
  });

  tearDown(() => db.close());

  Widget app() {
    return ProviderScope(
      overrides: [
        tunerControllerProvider.overrideWithValue(fake),
        kitbagDatabaseProvider.overrideWithValue(db),
        micPermissionRequestProvider.overrideWithValue(
          () async => MicPermission.granted,
        ),
      ],
      child: const MaterialApp(home: TunerScreen()),
    );
  }

  /// Pumps on a phone-portrait viewport so the editor sheet's string rows
  /// all fit on screen.
  Future<void> pumpApp(WidgetTester tester) async {
    tester.view.physicalSize = const Size(720, 1480);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(app());
    await tester.pump();
  }

  /// Unmounts the app and flushes drift's stream-cleanup timers so the
  /// binding's end-of-test pending-timer check passes.
  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  /// Bounded settle: the editor keeps a focused TextField (blinking
  /// cursor) alive, which starves pumpAndSettle.
  Future<void> settle(WidgetTester tester) async {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
  }

  Finder stepperButton(String label, IconData icon) => find.descendant(
    of: find.widgetWithText(KitbagStepperRow, label),
    matching: find.byIcon(icon),
  );

  testWidgets('saves the current preset as a custom tuning and applies it', (
    tester,
  ) async {
    await pumpApp(tester);

    await tester.tap(find.text('Guitar · Standard E'));
    await settle(tester);
    await tester.tap(find.text('Save as custom tuning…'));
    await settle(tester);

    // Seeded from the guitar preset: string 6 starts at E2.
    expect(find.text('E2'), findsOneWidget);
    // Drop the low E two semitones to D2.
    await tester.tap(stepperButton('String 6', Icons.remove));
    await tester.tap(stepperButton('String 6', Icons.remove));
    await tester.pump();
    expect(find.text('D2'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Drop D');
    await tester.pump();
    await tester.tap(find.text('Save'));
    await settle(tester);

    final saved = (await db.tuningsDao.getAll()).single;
    expect(saved.name, 'Drop D');
    expect(saved.notes, [38, 45, 50, 55, 59, 64]);

    // Applied immediately: chip label, peg letter and detection band.
    expect(find.text('Drop D · Custom'), findsOneWidget);
    expect(find.text('D'), findsWidgets);
    expect(fake.bandLowHz, closeTo(frequencyForMidi(38 - 5, fake.a4), 1e-6));
    await unmount(tester);
  });

  testWidgets('picks a saved tuning from the preset menu', (tester) async {
    await db.tuningsDao.create(
      'DADGAD',
      Uint8List.fromList([38, 45, 50, 55, 57, 62]),
    );
    await pumpApp(tester);

    await tester.tap(find.text('Guitar · Standard E'));
    await settle(tester);
    await tester.tap(find.text('DADGAD · Custom'));
    await settle(tester);

    expect(find.text('DADGAD · Custom'), findsOneWidget);
    final band = presetBand(
      presetFromNotes(id: 1, name: 'DADGAD', notes: [38, 45, 50, 55, 57, 62]),
      fake.a4,
    );
    expect(fake.bandLowHz, closeTo(band.lowHz, 1e-9));
    expect(fake.bandHighHz, closeTo(band.highHz, 1e-9));
    await unmount(tester);
  });

  testWidgets('edits a saved tuning from the menu', (tester) async {
    final id = await db.tuningsDao.create(
      'Drop D',
      Uint8List.fromList([38, 45, 50, 55, 59, 64]),
    );
    await pumpApp(tester);

    await tester.tap(find.text('Guitar · Standard E'));
    await settle(tester);
    await tester.tap(find.byTooltip('Edit tuning'));
    await settle(tester);

    // Drop the top string two semitones (double drop D).
    await tester.tap(stepperButton('String 1', Icons.remove));
    await tester.tap(stepperButton('String 1', Icons.remove));
    await tester.pump();
    await tester.enterText(find.byType(TextField), 'Double drop D');
    await tester.pump();
    await tester.tap(find.text('Save'));
    await settle(tester);

    final saved = (await db.tuningsDao.getAll()).single;
    expect(saved.id, id);
    expect(saved.name, 'Double drop D');
    expect(saved.notes, [38, 45, 50, 55, 59, 62]);
    expect(find.text('Double drop D · Custom'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('deleting the selected tuning falls back to guitar', (
    tester,
  ) async {
    await db.tuningsDao.create(
      'Drop D',
      Uint8List.fromList([38, 45, 50, 55, 59, 64]),
    );
    await pumpApp(tester);

    await tester.tap(find.text('Guitar · Standard E'));
    await settle(tester);
    await tester.tap(find.text('Drop D · Custom'));
    await settle(tester);
    expect(find.text('Drop D · Custom'), findsOneWidget);

    await tester.tap(find.text('Drop D · Custom'));
    await settle(tester);
    await tester.tap(find.byTooltip('Edit tuning'));
    await settle(tester);
    await tester.tap(find.text('Delete'));
    await settle(tester);
    await tester.tap(find.text('Delete').last); // confirm dialog
    await settle(tester);

    expect(await db.tuningsDao.getAll(), isEmpty);
    expect(find.text('Guitar · Standard E'), findsOneWidget);
    await unmount(tester);
  });
}
