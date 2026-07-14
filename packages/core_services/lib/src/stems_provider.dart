import 'package:core_db/core_db.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'database_provider.dart';

final stemsDaoProvider = Provider<StemsDao>(
  (ref) => ref.watch(kitbagDatabaseProvider).stemsDao,
);
