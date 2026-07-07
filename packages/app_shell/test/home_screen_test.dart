import 'package:app_shell/src/app.dart';
import 'package:app_shell/src/home_screen.dart';
import 'package:core_audio_ffi/testing.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('home hub renders wordmark and registered tool tiles', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          metronomeControllerProvider.overrideWithValue(
            FakeMetronomeController(),
          ),
          tunerControllerProvider.overrideWithValue(FakeTunerController()),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    expect(find.text('KITBAG'), findsOneWidget);
    expect(find.text('Metronome'), findsOneWidget);
    expect(find.text('Tuner'), findsOneWidget);
  });

  testWidgets('Continue card tracks the last tool the user opened', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        metronomeControllerProvider.overrideWithValue(
          FakeMetronomeController(),
        ),
        tunerControllerProvider.overrideWithValue(FakeTunerController()),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(container: container, child: const KitbagApp()),
    );
    await tester.pumpAndSettle();
    expect(find.text('Continue · Metronome'), findsOneWidget);

    final router = container.read(routerProvider);
    router.go('/tuner');
    await tester.pump(const Duration(milliseconds: 100));
    router.go('/');
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Continue · Tuner'), findsOneWidget);
  });
}
