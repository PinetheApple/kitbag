import 'package:core_db/core_db.dart';
import 'package:core_services/core_services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final stemSetsProvider = StreamProvider<List<StemSet>>((ref) {
  final dao = ref.watch(stemsDaoProvider);
  return dao.watchSets();
});

final stemsForSetProvider =
    FutureProvider.family<List<Stem>, int>((ref, setId) async {
  final dao = ref.watch(stemsDaoProvider);
  return dao.watchStems(setId).first;
});
