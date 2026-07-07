import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_audio_ffi/testing.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tool_tuner/src/instruments.dart';
import 'package:tool_tuner/src/mic_permission.dart';
import 'package:tool_tuner/src/tuner_screen.dart';
import 'package:tool_tuner/src/tuner_state.dart';

void main() {
  late FakeTunerController fake;

  Widget app({
    MicPermission permission = MicPermission.granted,
    bool failStart = false,
    Future<void> Function()? openSettings,
  }) {
    fake = FakeTunerController()..failStart = failStart;
    return ProviderScope(
      overrides: [
        tunerControllerProvider.overrideWithValue(fake),
        micPermissionRequestProvider.overrideWithValue(() async => permission),
        if (openSettings != null)
          openSystemSettingsProvider.overrideWithValue(openSettings),
      ],
      child: const MaterialApp(home: TunerScreen()),
    );
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

    await tester.pumpWidget(const SizedBox());
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
  });

  testWidgets('denied permission explains and never opens the mic', (
    tester,
  ) async {
    await tester.pumpWidget(app(permission: MicPermission.denied));
    await tester.pump();
    expect(find.text('Microphone unavailable'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
    expect(fake.startCalls, 0);
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
  });
}
