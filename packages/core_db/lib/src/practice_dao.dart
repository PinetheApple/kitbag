import 'package:drift/drift.dart';

import 'database.dart';

part 'practice_dao.g.dart';

@DriftAccessor(tables: [PracticeSessions])
class PracticeDao extends DatabaseAccessor<KitbagDatabase>
    with _$PracticeDaoMixin {
  PracticeDao(super.db);

  Future<int> create({
    required DateTime startTime,
    required int durationSeconds,
    required double avgBpm,
    int? setlistId,
    String? songsPlayed,
  }) =>
      into(practiceSessions).insert(PracticeSessionsCompanion(
        startTime: Value(startTime),
        durationSeconds: Value(durationSeconds),
        avgBpm: Value(avgBpm),
        setlistId: Value(setlistId),
        songsPlayed: Value(songsPlayed),
      ));

  Stream<List<PracticeSession>> watchAll() =>
      (select(practiceSessions)..orderBy([(t) => OrderingTerm.desc(t.startTime)]))
          .watch();

  Future<int> getTotalPracticeSeconds() async {
    final result =
        await customSelect('SELECT COALESCE(SUM(duration_seconds), 0) FROM practice_sessions')
            .getSingle();
    return result.read<int>('COALESCE(SUM(duration_seconds), 0)');
  }

  Future<int> getSessionCount() async {
    final result =
        await customSelect('SELECT COUNT(*) FROM practice_sessions').getSingle();
    return result.read<int>('COUNT(*)');
  }

  Future<void> deleteSession(int id) =>
      (delete(practiceSessions)..where((t) => t.id.equals(id))).go();

  Future<void> deleteAll() => delete(practiceSessions).go();
}
