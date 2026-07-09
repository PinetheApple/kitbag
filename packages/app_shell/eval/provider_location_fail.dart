// ignore_for_file: unused_import
// eval: provider_location — SHOULD trigger (Provider outside core_services)
import 'package:flutter_riverpod/flutter_riverpod.dart';

final exampleProvider = Provider<int>((ref) => 42);

final futureExampleProvider = FutureProvider<String>((ref) => 'hello');

class MyNotifier extends Notifier<int> {
  @override
  int build() => 0;
}

final notifierExampleProvider = NotifierProvider<MyNotifier, int>(MyNotifier.new);
