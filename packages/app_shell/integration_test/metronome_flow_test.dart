import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:app_shell/src/app.dart';

/// M1 proof on-device: open the metronome from the home hub, start it, and
/// verify the native sequencer runs and reports beats.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('metronome starts, beats advance, stops', (tester) async {
    late final ProviderContainer container;
    await tester.pumpWidget(
      ProviderScope(
        child: Consumer(
          builder: (context, ref, _) {
            container = ProviderScope.containerOf(context);
            return const KitbagApp();
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Metronome'));
    await tester.pumpAndSettle();

    final metronome = container.read(metronomeControllerProvider);
    expect(metronome.isRunning, isFalse);

    await tester.tap(find.byIcon(Icons.play_arrow));
    await tester.pump();
    expect(metronome.isRunning, isTrue);

    // At 120 BPM a new beat lands every 500ms; watch two land.
    final seen = <int>{};
    for (var i = 0; i < 30 && seen.length < 2; i++) {
      seen.add(metronome.currentBeat);
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    seen.remove(-1);
    expect(
      seen.length,
      greaterThanOrEqualTo(2),
      reason: 'beats should advance while running',
    );

    await tester.tap(find.byIcon(Icons.stop));
    await tester.pump();
    expect(metronome.isRunning, isFalse);
    expect(metronome.currentBeat, -1);
  });
}
