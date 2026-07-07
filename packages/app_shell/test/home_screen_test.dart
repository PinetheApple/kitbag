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
}
