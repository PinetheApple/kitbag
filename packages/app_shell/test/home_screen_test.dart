import 'package:app_shell/src/home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('home hub renders wordmark and engine smoke-test button', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: HomeScreen())),
    );

    expect(find.text('KITBAG'), findsOneWidget);
    expect(find.text('Play 440 Hz tone'), findsOneWidget);
  });
}
