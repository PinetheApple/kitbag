import 'package:core_audio_ffi/testing.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tool_metronome/src/metronome_screen.dart';
import 'package:tool_metronome/src/metronome_state.dart';
import 'package:tool_metronome/src/widgets/modifier_chips.dart';

/// User feedback drove two hard rules for the metronome layout:
///  1. the trainer/sound chips must sit in ONE row when they fit and wrap to
///     at most two rows — never one chip per line;
///  2. the screen must survive short/narrow/split windows and 200% text
///     without overflowing.
/// This suite pins both across the acceptance matrix.
void main() {
  Future<void> pumpAt(
    WidgetTester tester,
    Size logicalSize, {
    double textScale = 1.0,
  }) async {
    tester.view.physicalSize = logicalSize;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final fake = FakeMetronomeController();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [metronomeControllerProvider.overrideWithValue(fake)],
        child: MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(
              size: logicalSize,
              textScaler: TextScaler.linear(textScale),
            ),
            child: const MetronomeScreen(),
          ),
        ),
      ),
    );
    // Poly row enabled = the tallest configuration (the worst case for the
    // vertical budget, and it adds no chips, so the row rules still hold).
    final container = ProviderScope.containerOf(
      tester.element(find.byType(MetronomeScreen)),
    );
    container.read(metronomeProvider.notifier).togglePolyrhythm();
    await tester.pumpAndSettle();
  }

  /// The distinct vertical bands occupied by the modifier chips. One band =
  /// a single row; the count is how many rows the chips wrapped into.
  int chipRowCount(WidgetTester tester) {
    final chips = find.descendant(
      of: find.byType(ModifierChipRow),
      matching: find.byType(KitbagChip),
    );
    expect(chips, findsNWidgets(3), reason: 'ramp + mute + sound chips');
    final tops = <double>{};
    for (final element in chips.evaluate()) {
      final top = tester.getTopLeft(find.byWidget(element.widget)).dy;
      // Snap near-equal tops (sub-pixel/hit-target centering) into one band.
      tops.add((top / 4).roundToDouble());
    }
    return tops.length;
  }

  // Portrait, landscape and split geometries from the acceptance criteria.
  const matrix = <String, Size>{
    'portrait 480x800': Size(480, 800),
    'portrait 360x640': Size(360, 640),
    'narrow-tall 300x567': Size(300, 567),
    'landscape 640x360': Size(640, 360),
    'split 360x420': Size(360, 420),
  };

  matrix.forEach((name, size) {
    testWidgets('$name: no overflow, chips never one-per-line', (tester) async {
      await pumpAt(tester, size);
      expect(tester.takeException(), isNull);
      expect(find.text('TAP'), findsOneWidget);
      // Transport stays reachable (play button present, not scrolled off).
      expect(find.byType(KitbagPlayButton), findsOneWidget);
      // The cardinal rule: chips share a row, wrapping to two at most.
      expect(
        chipRowCount(tester),
        lessThanOrEqualTo(2),
        reason: 'chips must never render one-per-line',
      );
    });
  });

  // Roomy widths must collapse the chips onto a single row.
  for (final size in const [Size(480, 800), Size(360, 640)]) {
    testWidgets('${size.width.toInt()}dp wide: chips share one row', (
      tester,
    ) async {
      await pumpAt(tester, size);
      expect(chipRowCount(tester), 1);
    });
  }

  // 200% text scale must not overflow and must not break the chip rule,
  // across a portrait, a landscape and a split window.
  for (final entry in const {
    'portrait 480x800': Size(480, 800),
    'landscape 640x360': Size(640, 360),
    'split 360x420': Size(360, 420),
  }.entries) {
    testWidgets('${entry.key} @ 2x text: no overflow', (tester) async {
      await pumpAt(tester, entry.value, textScale: 2.0);
      expect(tester.takeException(), isNull);
      expect(find.text('TAP'), findsOneWidget);
      expect(chipRowCount(tester), lessThanOrEqualTo(2));
    });
  }
}
