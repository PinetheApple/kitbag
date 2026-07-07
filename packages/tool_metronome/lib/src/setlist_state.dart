import 'dart:typed_data';

import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_db/core_db.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'metronome_state.dart';

/// Songs store one `kb_accent` code byte per beat (schema `accents` blob).
Uint8List encodeAccents(List<BeatAccent> accents) =>
    Uint8List.fromList([for (final accent in accents) accent.code]);

List<BeatAccent> decodeAccents(Uint8List blob) => [
  for (final code in blob)
    BeatAccent.values.firstWhere(
      (accent) => accent.code == code,
      orElse: () => BeatAccent.normal,
    ),
];

final setlistsProvider = StreamProvider.autoDispose<List<SetlistSummary>>(
  (ref) => ref.watch(kitbagDatabaseProvider).setlistsDao.watchAll(),
);

final setlistProvider = StreamProvider.autoDispose.family<Setlist, int>(
  (ref, id) => ref.watch(kitbagDatabaseProvider).setlistsDao.watchSetlist(id),
);

final setlistSongsProvider = StreamProvider.autoDispose.family<List<Song>, int>(
  (ref, setlistId) =>
      ref.watch(kitbagDatabaseProvider).songsDao.watchBySetlist(setlistId),
);

/// The setlist session currently driving the metronome.
class ActiveSetlist {
  const ActiveSetlist({
    required this.setlist,
    required this.songs,
    required this.index,
  });

  final Setlist setlist;
  final List<Song> songs;
  final int index;

  bool get hasPrevious => index > 0;
  bool get hasNext => index < songs.length - 1;

  /// App-bar chip text, e.g. "Wedding set · 3/12".
  String get label => '${setlist.name} · ${index + 1}/${songs.length}';
}

final activeSetlistProvider =
    NotifierProvider<ActiveSetlistNotifier, ActiveSetlist?>(
      ActiveSetlistNotifier.new,
    );

class ActiveSetlistNotifier extends Notifier<ActiveSetlist?> {
  @override
  ActiveSetlist? build() => null;

  /// Starts (or re-anchors) a session and applies the song at [index].
  void play({
    required Setlist setlist,
    required List<Song> songs,
    required int index,
  }) {
    state = ActiveSetlist(setlist: setlist, songs: songs, index: index);
    _apply(songs[index]);
  }

  void next() => _moveBy(1);

  void previous() => _moveBy(-1);

  void clear() => state = null;

  void _moveBy(int delta) {
    final active = state;
    if (active == null) {
      return;
    }
    final index = active.index + delta;
    if (index < 0 || index >= active.songs.length) {
      return;
    }
    state = ActiveSetlist(
      setlist: active.setlist,
      songs: active.songs,
      index: index,
    );
    _apply(active.songs[index]);
  }

  void _apply(Song song) {
    ref
        .read(metronomeProvider.notifier)
        .applyPreset(
          bpm: song.bpm,
          beatsPerBar: song.beatsPerBar,
          subdivision: song.subdivision,
          accents: decodeAccents(song.accents),
          sound: song.sound,
        );
  }
}
