import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_audio_ffi/testing.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tool_tuner/src/instruments.dart';
import 'package:tool_tuner/src/tuner_screen.dart';
import 'package:tool_tuner/src/tuner_state.dart';

void main() {
  late FakeTunerController fake;

  Widget app() {
    fake = FakeTunerController();
    return ProviderScope(
      overrides: [tunerControllerProvider.overrideWithValue(fake)],
      child: const MaterialApp(home: TunerScreen()),
    );
  }

  void report({required int noteIndex, required double cents}) {
    fake.reportedNoteIndex = noteIndex;
    fake.reportedCents = cents;
    fake.reportedPitchHz = frequencyForMidi(noteIndex, fake.a4);
    fake.reportedConfidence = 1;
  }

  testWidgets('starts the mic and pushes the guitar auto band', (tester) async {
    await tester.pumpWidget(app());
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
    report(noteIndex: 55, cents: 1); // G3 in tune
    await tester.pump();
    expect(find.text('IN TUNE'), findsOneWidget);

    final container = ProviderScope.containerOf(
      tester.element(find.byType(TunerScreen)),
    );
    expect(container.read(tunerProvider).tunedStrings, contains(3));
  });

  testWidgets('tapping a peg locks its narrow string band', (tester) async {
    await tester.pumpWidget(app());
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
    expect(find.text('6'), findsOneWidget);

    await tester.tap(find.text('Chromatic'));
    await tester.pump();
    expect(find.text('6'), findsNothing);
    expect(fake.bandLowHz, TunerController.chromaticLowHz);
    expect(fake.bandHighHz, TunerController.chromaticHighHz);
  });
}
