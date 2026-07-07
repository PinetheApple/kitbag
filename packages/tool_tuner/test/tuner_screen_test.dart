import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_audio_ffi/testing.dart';
import 'package:core_db/core_db.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tool_tuner/src/instruments.dart';
import 'package:tool_tuner/src/mic_permission.dart';
import 'package:tool_tuner/src/tuner_screen.dart';
import 'package:tool_tuner/src/tuner_state.dart';

void main() {
  late FakeTunerController fake;
  late KitbagDatabase db;

  setUp(() => db = KitbagDatabase(NativeDatabase.memory()));
  tearDown(() => db.close());

  Widget app({
    MicPermission permission = MicPermission.granted,
    bool failStart = false,
    Future<void> Function()? openSettings,
  }) {
    fake = FakeTunerController()..failStart = failStart;
    return ProviderScope(
      overrides: [
        tunerControllerProvider.overrideWithValue(fake),
        kitbagDatabaseProvider.overrideWithValue(db),
        micPermissionRequestProvider.overrideWithValue(() async => permission),
        if (openSettings != null)
          openSystemSettingsProvider.overrideWithValue(openSettings),
      ],
      child: const MaterialApp(home: TunerScreen()),
    );
  }

  /// Unmounts the app and flushes drift's stream-cleanup timers so the
  /// binding's end-of-test pending-timer check passes.
  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  void report({required int noteIndex, required double cents}) {
    fake.reading = TunerReading(
      noteIndex: noteIndex,
      cents: cents,
      confidence: 1,
    );
  }

  testWidgets('starts the mic and pushes the guitar auto band', (tester) async {
    await tester.pumpWidget(app());
    await tester.pump(); // permission future resolves
    expect(fake.running, isTrue);
    expect(fake.a4, TunerController.defaultA4);
    final band = presetBand(InstrumentPreset.guitar, fake.a4);
    expect(fake.bandLowHz, closeTo(band.lowHz, 1e-9));
    expect(fake.bandHighHz, closeTo(band.highHz, 1e-9));

    await unmount(tester);
    expect(fake.running, isFalse);
  });

  testWidgets('shows the detected note, cents and direction', (tester) async {
    await tester.pumpWidget(app());
    await tester.pump();
    report(noteIndex: 55, cents: -4); // G3, flat
    await tester.pump();
    expect(find.text('G3'), findsOneWidget);
    expect(find.text('−4 CENTS · TUNE UP ↑'), findsOneWidget);

    report(noteIndex: 55, cents: 12);
    await tester.pump();
    expect(find.text('+12 CENTS · TUNE DOWN ↓'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('marks a string tuned at the in-tune moment', (tester) async {
    await tester.pumpWidget(app());
    await tester.pump();
    report(noteIndex: 55, cents: 1); // G3 in tune
    await tester.pump();
    await tester.pump(); // note change propagates to the headstock
    expect(find.text('IN TUNE'), findsOneWidget);

    final container = ProviderScope.containerOf(
      tester.element(find.byType(TunerScreen)),
    );
    expect(container.read(tunerProvider).tunedStrings, contains(3));
    await unmount(tester);
  });

  testWidgets('tapping a peg locks its narrow string band', (tester) async {
    await tester.pumpWidget(app());
    await tester.pump();
    await tester.tap(find.text('6')); // low E peg
    await tester.pump();

    final band = stringBand(InstrumentPreset.guitar.strings[0], fake.a4);
    expect(fake.bandLowHz, closeTo(band.lowHz, 1e-9));
    expect(fake.bandHighHz, closeTo(band.highHz, 1e-9));

    // Tap again releases back to the auto band.
    await tester.tap(find.text('6'));
    await tester.pump();
    final autoBand = presetBand(InstrumentPreset.guitar, fake.a4);
    expect(fake.bandLowHz, closeTo(autoBand.lowHz, 1e-9));
    await unmount(tester);
  });

  testWidgets('Auto chip lights only while auto-detection is the live mode', (
    tester,
  ) async {
    await tester.pumpWidget(app());
    await tester.pump();
    KitbagChip autoChip() =>
        tester.widget<KitbagChip>(find.widgetWithText(KitbagChip, 'Auto'));

    // Default: instrument mode, no locked string → auto-detect is live.
    expect(autoChip().active, isTrue);

    // Locking a peg makes a per-string lock the live mode instead.
    await tester.tap(find.text('6'));
    await tester.pump();
    expect(autoChip().active, isFalse);

    // Releasing the lock returns to auto-detect.
    await tester.tap(find.text('6'));
    await tester.pump();
    expect(autoChip().active, isTrue);

    // Chromatic mode is not auto string detection.
    await tester.tap(find.text('Chromatic'));
    await tester.pump();
    expect(autoChip().active, isFalse);
    await unmount(tester);
  });

  testWidgets('chromatic chip strips the pegs and widens the band', (
    tester,
  ) async {
    await tester.pumpWidget(app());
    await tester.pump();
    expect(find.text('6'), findsOneWidget);

    await tester.tap(find.text('Chromatic'));
    await tester.pump();
    expect(find.text('6'), findsNothing);
    expect(fake.bandLowHz, TunerController.chromaticLowHz);
    expect(fake.bandHighHz, TunerController.chromaticHighHz);
    await unmount(tester);
  });

  testWidgets('failed mic start shows retry that recovers', (tester) async {
    await tester.pumpWidget(app(failStart: true));
    await tester.pump();
    expect(find.text('Microphone unavailable'), findsOneWidget);
    expect(fake.running, isFalse);

    fake.failStart = false;
    await tester.tap(find.text('Try again'));
    await tester.pump();
    expect(fake.running, isTrue);
    expect(find.text('Microphone unavailable'), findsNothing);
    await unmount(tester);
  });

  testWidgets('denied permission explains and never opens the mic', (
    tester,
  ) async {
    await tester.pumpWidget(app(permission: MicPermission.denied));
    await tester.pump();
    expect(find.text('Microphone unavailable'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
    expect(fake.startCalls, 0);
    await unmount(tester);
  });

  testWidgets('permanently denied permission offers system settings', (
    tester,
  ) async {
    var opened = false;
    await tester.pumpWidget(
      app(
        permission: MicPermission.permanentlyDenied,
        openSettings: () async => opened = true,
      ),
    );
    await tester.pump();
    expect(find.text('Open settings'), findsOneWidget);
    await tester.tap(find.text('Open settings'));
    expect(opened, isTrue);
    await unmount(tester);
  });

  testWidgets('holds the last note briefly after the signal drops', (
    tester,
  ) async {
    await tester.pumpWidget(app());
    await tester.pump();
    report(noteIndex: 55, cents: -4);
    await tester.pump();
    expect(find.text('G3'), findsOneWidget);

    // String stops ringing: the reading lingers instead of snapping away.
    fake.reading = const TunerReading.none();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('G3'), findsOneWidget);
    expect(find.text('PLAY A NOTE'), findsNothing);

    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('G3'), findsOneWidget);

    // Past the hold window it relaxes to idle.
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('G3'), findsNothing);
    expect(find.text('PLAY A NOTE'), findsOneWidget);

    // Fast attack: a fresh detection shows immediately.
    report(noteIndex: 64, cents: 2);
    await tester.pump();
    expect(find.text('E4'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('re-entering the tuner starts a fresh session', (tester) async {
    fake = FakeTunerController();
    final container = ProviderContainer(
      overrides: [
        tunerControllerProvider.overrideWithValue(fake),
        kitbagDatabaseProvider.overrideWithValue(db),
        micPermissionRequestProvider.overrideWithValue(
          () async => MicPermission.granted,
        ),
      ],
    );
    addTearDown(container.dispose);
    Widget host(Widget child) => UncontrolledProviderScope(
      container: container,
      child: MaterialApp(home: child),
    );

    // First visit: lock a string and get it in tune.
    await tester.pumpWidget(host(const TunerScreen()));
    await tester.pump();
    await tester.tap(find.text('6')); // lock low E
    await tester.pump();
    report(noteIndex: 40, cents: 0); // E2 in tune
    await tester.pump();
    await tester.pump();
    expect(container.read(tunerProvider).tunedStrings, contains(0));
    expect(container.read(tunerProvider).lockedString, 0);

    // Leave for home, then come back.
    await tester.pumpWidget(host(const SizedBox()));
    expect(fake.running, isFalse);
    await tester.pumpWidget(host(const TunerScreen()));
    await tester.pump();

    // Transient state is gone; nothing renders until a fresh detection.
    expect(container.read(tunerProvider).tunedStrings, isEmpty);
    expect(container.read(tunerProvider).lockedString, isNull);
    expect(find.text('IN TUNE'), findsNothing);
    expect(find.text('PLAY A NOTE'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('backgrounding stops the mic, resuming restarts it', (
    tester,
  ) async {
    await tester.pumpWidget(app());
    await tester.pump();
    expect(fake.running, isTrue);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    expect(fake.running, isFalse);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(fake.running, isTrue);
    await unmount(tester);
  });
}
