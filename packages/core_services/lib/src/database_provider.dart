import 'package:core_db/core_db.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final kitbagDatabaseProvider = Provider<KitbagDatabase>((ref) {
  final db = KitbagDatabase.open();
  ref.onDispose(db.close);
  return db;
});
