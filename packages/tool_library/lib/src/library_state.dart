import 'package:core_db/core_db.dart';
import 'package:core_services/core_services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class LibrarySettings {
  const LibrarySettings({this.songCount = 0});

  final int songCount;

  LibrarySettings copyWith({int? songCount}) =>
      LibrarySettings(songCount: songCount ?? this.songCount);
}

final libraryProvider = NotifierProvider<LibraryNotifier, LibrarySettings>(
  LibraryNotifier.new,
);

class LibraryNotifier extends Notifier<LibrarySettings> {
  @override
  LibrarySettings build() => const LibrarySettings();

  void setSongCount(int count) => state = state.copyWith(songCount: count);
}

final librarySongsProvider = StreamProvider<List<LibrarySong>>((ref) {
  final db = ref.watch(kitbagDatabaseProvider);
  return db.librarySongsDao.watchAll();
});
