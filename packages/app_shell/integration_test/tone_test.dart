import 'package:app_shell/src/plugin_registry.dart';
import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:app_shell/src/home_screen.dart';

/// M0 proof: pressing the home-hub button drives the native engine — the
/// sample clock advances while the tone plays.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('test tone renders frames through the native engine',
      (tester) async {
    late final AudioEngine engine;
    final scope = ProviderScope(
      child: Consumer(builder: (context, ref, _) {
        engine = ref.read(audioEngineProvider);
        return const MaterialApp(home: HomeScreen());
      }),
    );

    await tester.pumpWidget(scope);
    expect(engine.sampleRate, 48000);

    final framesBefore = engine.framesRendered;
    await tester.tap(find.text('Play 440 Hz tone'));
    await tester.pump();
    await Future<void>.delayed(const Duration(seconds: 1));

    expect(engine.framesRendered, greaterThan(framesBefore));

    await tester.tap(find.text('Stop tone'));
    await tester.pump();
  });
}
