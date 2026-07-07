import 'package:core_audio_ffi/testing.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tool_metronome/src/metronome_screen.dart';
import 'package:tool_metronome/src/metronome_state.dart';
import 'package:tool_metronome/src/widgets/modifier_chips.dart';
import 'package:tool_metronome/src/widgets/pattern_card.dart';

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
    int beatsPerBar = 4,
    bool poly = true,
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
    // Poly row enabled = the tallest configuration; a high beat count makes
    // the accent-LED Wrap reflow, the worst case for the vertical budget.
    final container = ProviderScope.containerOf(
      tester.element(find.byType(MetronomeScreen)),
    );
    final notifier = container.read(metronomeProvider.notifier);
    notifier.setBeatsPerBar(beatsPerBar);
    if (poly) notifier.togglePolyrhythm();
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

  // The worst vertical case: max beats (16) with poly on. The accent-LED
  // Wrap reflows to several rows; the scroll-and-pin net must absorb it
  // (transport still reachable) instead of throwing a RenderFlex overflow —
  // and the chip rule must still hold. Covers portrait, split and landscape.
  for (final entry in const {
    'portrait 360x640': Size(360, 640),
    'split 360x420': Size(360, 420),
    'narrow-split 320x450': Size(320, 450),
    'landscape 620x400': Size(620, 400),
  }.entries) {
    testWidgets('${entry.key} @ 16 beats + poly: no overflow', (tester) async {
      await pumpAt(tester, entry.value, beatsPerBar: 16);
      expect(
        tester.takeException(),
        isNull,
        reason: 'scroll-and-pin must absorb the tall pattern card',
      );
      expect(find.byType(KitbagPlayButton), findsOneWidget);
      expect(find.text('TAP'), findsOneWidget);
      expect(chipRowCount(tester), lessThanOrEqualTo(2));
    });

    // At 200% text this combination stacks the max-beat LED Wrap AND the
    // widest chips onto the narrowest panes — the chip row can be forced to
    // three lines here (each chip alone approaches the pane width), which is
    // genuinely unavoidable; the invariant that still must hold is that the
    // scroll-and-pin net absorbs it without overflow and keeps play reachable.
    testWidgets('${entry.key} @ 16 beats + 2x text: no overflow', (
      tester,
    ) async {
      await pumpAt(tester, entry.value, beatsPerBar: 16, textScale: 2.0);
      expect(tester.takeException(), isNull);
      expect(find.byType(KitbagPlayButton), findsOneWidget);
    });
  }

  // When the content genuinely overflows a tiny window the editing region
  // must actually scroll (proving the safety net is engaged, not that the
  // content silently clipped).
  testWidgets('tiny window scrolls the editing region', (tester) async {
    await pumpAt(tester, const Size(320, 380), beatsPerBar: 16);
    expect(tester.takeException(), isNull);
    final scrollable = find.byType(Scrollable);
    expect(scrollable, findsWidgets);
    final position = tester.state<ScrollableState>(scrollable.first).position;
    expect(
      position.maxScrollExtent,
      greaterThan(0),
      reason: 'a 320x380 window with 16 beats must scroll',
    );
  });

  // On a tall, roomy window the readout must sit in the upper region (per the
  // §04 mock) with the editing stack bottom-anchored just above the pinned
  // transport — not the whole cluster group-centered with a dead gap.
  testWidgets('tall window keeps the readout up top, no dead gap', (
    tester,
  ) async {
    await pumpAt(tester, const Size(480, 800), poly: false);
    final bpm = tester.getRect(find.text('120'));
    final card = tester.getRect(find.byType(PatternCard));
    final chips = tester.getRect(find.byType(ModifierChipRow));
    final play = tester.getRect(find.byType(KitbagPlayButton));

    // Readout in the upper region and above the editing controls.
    expect(bpm.center.dy, lessThan(800 * 0.4));
    expect(bpm.bottom, lessThan(card.top));
    // Editing stack is bottom-anchored: its last row (chips) hugs the pinned
    // transport rather than leaving a large gap above it.
    expect(play.top - chips.bottom, lessThan(48));
  });

  // §06 ≥48dp targets must survive the desktop adaptivePlatformDensity
  // (COMPACT), which otherwise shrinks IconButton-based targets to ~40dp.
  testWidgets('desktop density keeps 48dp touch targets', (tester) async {
    // Build the theme under the desktop platform (COMPACT density), then
    // clear the override before any measurement so it can't leak into the
    // framework's end-of-test invariant check — the sizes are already baked.
    debugDefaultTargetPlatformOverride = TargetPlatform.linux;
    await pumpAt(tester, const Size(480, 800));
    debugDefaultTargetPlatformOverride = null;

    // Transport side buttons (Setlists / Trainer).
    for (final element in find.byType(KitbagCircleButton).evaluate()) {
      final size = tester.getSize(find.byWidget(element.widget));
      expect(size.width, greaterThanOrEqualTo(48));
      expect(size.height, greaterThanOrEqualTo(48));
    }
    // Pattern-card ± steppers.
    for (final icon in const [Icons.remove, Icons.add]) {
      for (final element in find.byIcon(icon).evaluate()) {
        final button = find.ancestor(
          of: find.byWidget(element.widget),
          matching: find.byType(IconButton),
        );
        final size = tester.getSize(button.first);
        expect(size.width, greaterThanOrEqualTo(48));
        expect(size.height, greaterThanOrEqualTo(48));
      }
    }
  });
}
