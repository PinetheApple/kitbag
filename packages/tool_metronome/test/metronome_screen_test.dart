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
