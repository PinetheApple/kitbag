import 'package:core_audio_ffi/testing.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tool_metronome/src/metronome_screen.dart';
import 'package:tool_metronome/src/metronome_state.dart';

/// User feedback: the metronome must not overflow on short windows.
/// Compact layout kicks in below ~620dp; below ~420dp the body scrolls.
void main() {
  Future<void> pumpAt(WidgetTester tester, Size logicalSize) async {
    tester.view.physicalSize = logicalSize;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final fake = FakeMetronomeController();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [metronomeControllerProvider.overrideWithValue(fake)],
        child: const MaterialApp(home: MetronomeScreen()),
      ),
    );
    // Poly row enabled = the tallest configuration.
    final container = ProviderScope.containerOf(
      tester.element(find.byType(MetronomeScreen)),
    );
    container.read(metronomeProvider.notifier).togglePolyrhythm();
    await tester.pump();
  }

  for (final size in const [
    Size(800, 600),
    Size(700, 500),
    Size(600, 430),
    Size(500, 340),
  ]) {
    testWidgets('renders without overflow at ${size.height}dp height', (
      tester,
    ) async {
      await pumpAt(tester, size);
      expect(tester.takeException(), isNull);
      expect(find.text('TAP'), findsOneWidget);
    });
  }
}
