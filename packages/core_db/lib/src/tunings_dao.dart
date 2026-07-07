import 'package:drift/drift.dart';

import 'database.dart';

part 'tunings_dao.g.dart';

@DriftAccessor(tables: [Tunings])
class TuningsDao extends DatabaseAccessor<KitbagDatabase>
    with _$TuningsDaoMixin {
  TuningsDao(super.db);

  /// All saved tunings in creation order.
  Stream<List<Tuning>> watchAll() =>
      (select(tunings)..orderBy([(t) => OrderingTerm.asc(t.id)])).watch();

  Future<int> create(String name, Uint8List notes) =>
      into(tunings).insert(TuningsCompanion.insert(name: name, notes: notes));

  Future<void> rename(int id, String name) => (update(
    tunings,
  )..where((t) => t.id.equals(id))).write(TuningsCompanion(name: Value(name)));

  Future<void> updateNotes(int id, Uint8List notes) =>
      (update(tunings)..where((t) => t.id.equals(id))).write(
        TuningsCompanion(notes: Value(notes)),
      );

  Future<void> deleteTuning(int id) =>
      (delete(tunings)..where((t) => t.id.equals(id))).go();
}
