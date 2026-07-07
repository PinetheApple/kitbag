import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_audio_ffi/testing.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tool_metronome/src/metronome_screen.dart';
import 'package:tool_metronome/src/metronome_state.dart';

void main() {
  late FakeMetronomeController fake;

  Widget app() {
    fake = FakeMetronomeController();
    return ProviderScope(
      overrides: [metronomeControllerProvider.overrideWithValue(fake)],
      child: const MaterialApp(home: MetronomeScreen()),
    );
  }

  // pumpAndSettle never settles here: the LED/chip tickers run every frame.
  Future<void> pumpSheet(WidgetTester tester) async {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  testWidgets('renders default tempo and pushes settings to the engine', (
    tester,
  ) async {
    await tester.pumpWidget(app());
    expect(find.text('120'), findsOneWidget);
    expect(fake.tempo, 120);
    expect(fake.beatsPerBar, 4);
  });

  testWidgets('preset buttons nudge tempo', (tester) async {
    await tester.pumpWidget(app());
    await tester.tap(find.text('+10'));
    await tester.pump();
    expect(find.text('130'), findsOneWidget);
    expect(fake.tempo, 130);

    await tester.tap(find.text('−5'));
    await tester.pump();
    expect(find.text('125'), findsOneWidget);
  });

  testWidgets('vertical drag anywhere changes tempo', (tester) async {
    await tester.pumpWidget(app());
    await tester.drag(
      find.byType(MetronomeScreen),
      const Offset(0, -80),
    ); // up = faster
    await tester.pump();
    expect(fake.tempo, 130);
  });

  testWidgets('play button starts and stops the sequencer', (tester) async {
    await tester.pumpWidget(app());
    await tester.tap(find.byIcon(Icons.play_arrow));
    await tester.pump();
    expect(fake.running, isTrue);
    await tester.tap(find.byIcon(Icons.stop));
    await tester.pump();
    expect(fake.running, isFalse);
  });

  testWidgets('ramp chip opens the sheet and enables the ramp', (tester) async {
    await tester.pumpWidget(app());
    await tester.tap(find.text('Ramp'));
    await pumpSheet(tester);
    expect(find.text('Tempo ramp'), findsOneWidget);

    await tester.tap(find.byTooltip('Increase Start BPM'));
    await tester.pump();
    await tester.tap(find.text('START RAMP'));
    await pumpSheet(tester);

    expect(fake.rampEnabled, isTrue);
    expect(fake.rampStartBpm, 105);
    expect(fake.rampEndBpm, 140);
    expect(fake.rampBars, 8);
    // Active chip shows the live (fake: start) BPM and the target.
    expect(find.text('Ramp 105→140'), findsOneWidget);
    // The big readout must show what will sound, not the old dial value.
    expect(find.text('105'), findsOneWidget);
    expect(find.text('120'), findsNothing);
  });

  testWidgets('mute chip enables, shows the cycle, and turns off', (
    tester,
  ) async {
    await tester.pumpWidget(app());
    await tester.tap(find.text('Mute bars'));
    await pumpSheet(tester);
    await tester.tap(find.text('START MUTING'));
    await pumpSheet(tester);

    expect(fake.barMuteEnabled, isTrue);
    expect(fake.playBars, 3);
    expect(fake.muteBars, 1);
    expect(find.text('Mute 3+1'), findsOneWidget);

    await tester.tap(find.text('Mute 3+1'));
    await pumpSheet(tester);
    await tester.tap(find.text('TURN OFF'));
    await pumpSheet(tester);
    expect(fake.barMuteEnabled, isFalse);
    expect(find.text('Mute bars'), findsOneWidget);
  });

  testWidgets('manual tempo change cancels an active ramp', (tester) async {
    await tester.pumpWidget(app());
    await tester.tap(find.text('Ramp'));
    await pumpSheet(tester);
    await tester.tap(find.text('START RAMP'));
    await pumpSheet(tester);
    expect(fake.rampEnabled, isTrue);

    await tester.tap(find.text('+10'));
    await tester.pump();
    expect(find.text('Ramp'), findsOneWidget);
    expect(fake.rampEnabled, isFalse);
    // Nudge is relative to the tempo being heard (ramp default start: 100).
    expect(fake.tempo, 110);
    expect(find.text('110'), findsOneWidget);
  });

  testWidgets('tapping a beat LED cycles its accent', (tester) async {
    await tester.pumpWidget(app());
    final container = ProviderScope.containerOf(
      tester.element(find.byType(MetronomeScreen)),
    );
    expect(container.read(metronomeProvider).accents[0], BeatAccent.accented);

    final leds = find.byWidgetPredicate(
      (widget) => widget.runtimeType.toString() == '_Led',
    );
    await tester.tap(leds.first);
    await tester.pump();
    expect(container.read(metronomeProvider).accents[0], BeatAccent.normal);
    expect(fake.accents[0], BeatAccent.normal);
  });
}
