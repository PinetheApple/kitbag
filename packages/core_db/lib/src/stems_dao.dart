import 'package:drift/drift.dart';

import 'database.dart';

part 'stems_dao.g.dart';

@DriftAccessor(tables: [StemSets, Stems])
class StemsDao extends DatabaseAccessor<KitbagDatabase>
    with _$StemsDaoMixin {
  StemsDao(super.db);

  // --- Stem Sets ---

  Future<int> createSet({required String name}) =>
      into(stemSets).insert(StemSetsCompanion(
        name: Value(name),
        createdAt: Value(DateTime.now()),
      ));

  Future<void> deleteSet(int id) =>
      (delete(stemSets)..where((t) => t.id.equals(id))).go();

  Stream<List<StemSet>> watchSets() =>
      (select(stemSets)..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
          .watch();

  Future<StemSet?> getSetById(int id) =>
      (select(stemSets)..where((t) => t.id.equals(id))).getSingleOrNull();

  Future<int> getSetCount() =>
      customSelect('SELECT COUNT(*) FROM stem_sets')
          .getSingle()
          .then((r) => r.read<int>('COUNT(*)'));

  // --- Stems ---

  Future<int> createStem({
    required int stemSetId,
    required String role,
    required String filePath,
    required double duration,
    required String format,
    required int channelCount,
    required int sampleRate,
    required int sortOrder,
  }) =>
      into(stems).insert(StemsCompanion(
        stemSetId: Value(stemSetId),
        role: Value(role),
        filePath: Value(filePath),
        duration: Value(duration),
        format: Value(format),
        channelCount: Value(channelCount),
        sampleRate: Value(sampleRate),
        gain: Value(1.0),
        muted: Value(false),
        soloed: Value(false),
        sortOrder: Value(sortOrder),
      ));

  Stream<List<Stem>> watchStems(int stemSetId) =>
      (select(stems)
            ..where((t) => t.stemSetId.equals(stemSetId))
            ..orderBy([(t) => OrderingTerm.asc(t.sortOrder)]))
          .watch();

  Future<void> updateGain(int stemId, double gain) =>
      (update(stems)..where((t) => t.id.equals(stemId))).write(
        StemsCompanion(gain: Value(gain)),
      );

  Future<void> toggleMute(int stemId) async {
    final s = await (select(stems)..where((t) => t.id.equals(stemId)))
        .getSingle();
    await (update(stems)..where((t) => t.id.equals(stemId))).write(
      StemsCompanion(muted: Value(!s.muted)),
    );
  }

  Future<void> toggleSolo(int stemId) async {
    final s = await (select(stems)..where((t) => t.id.equals(stemId)))
        .getSingle();
    await (update(stems)..where((t) => t.id.equals(stemId))).write(
      StemsCompanion(soloed: Value(!s.soloed)),
    );
  }

  Future<void> deleteStem(int id) =>
      (delete(stems)..where((t) => t.id.equals(id))).go();

  Future<void> deleteStemsForSet(int stemSetId) =>
      (delete(stems)..where((t) => t.stemSetId.equals(stemSetId))).go();
}
