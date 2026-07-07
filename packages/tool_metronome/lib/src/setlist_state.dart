import 'dart:async';
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

/// The session stays subscribed to the database, so renames, recaptures,
/// reorders and deletions during a gig are reflected live: the chip label
/// stays truthful and paging always applies the stored preset as it is now.
class ActiveSetlistNotifier extends Notifier<ActiveSetlist?> {
  StreamSubscription<List<Song>>? _songsSubscription;
  StreamSubscription<Setlist?>? _setlistSubscription;

  @override
  ActiveSetlist? build() {
    ref.onDispose(_unsubscribe);
    return null;
  }

  /// Starts (or re-anchors) a session and applies the song at [index].
  void play({
    required Setlist setlist,
    required List<Song> songs,
    required int index,
  }) {
    _subscribe(setlist.id);
    state = ActiveSetlist(setlist: setlist, songs: songs, index: index);
    _apply(songs[index]);
  }

  void next() => _moveBy(1);

  void previous() => _moveBy(-1);

  void clear() {
    _unsubscribe();
    state = null;
  }

  void _subscribe(int setlistId) {
    _unsubscribe();
    final db = ref.read(kitbagDatabaseProvider);
    _songsSubscription = db.songsDao
        .watchBySetlist(setlistId)
        .listen(_onSongsChanged);
    _setlistSubscription = db.setlistsDao
        .watchSetlistOrNull(setlistId)
        .listen(_onSetlistChanged);
  }

  void _unsubscribe() {
    unawaited(_songsSubscription?.cancel());
    unawaited(_setlistSubscription?.cancel());
    _songsSubscription = null;
    _setlistSubscription = null;
  }

  /// Reconciles the session with the stored songs: follow the current song
  /// by id (rename/reorder/recapture keep the position), clamp the index if
  /// it was deleted, end the session when nothing is left. Never re-applies
  /// mid-song — what is sounding stays untouched until the user pages.
  void _onSongsChanged(List<Song> songs) {
    final active = state;
    if (active == null) {
      return;
    }
    if (songs.isEmpty) {
      clear();
      return;
    }
    final currentId = active.songs[active.index].id;
    var index = songs.indexWhere((song) => song.id == currentId);
    if (index == -1) {
      index = active.index.clamp(0, songs.length - 1);
    }
    state = ActiveSetlist(setlist: active.setlist, songs: songs, index: index);
  }

  void _onSetlistChanged(Setlist? setlist) {
    final active = state;
    if (active == null) {
      return;
    }
    if (setlist == null) {
      // The active setlist itself was deleted; other deletions don't end
      // the session.
      clear();
      return;
    }
    state = ActiveSetlist(
      setlist: setlist,
      songs: active.songs,
      index: active.index,
    );
  }

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
          polyEnabled: song.polyEnabled,
          polyBeats: song.polyBeats,
          sound: song.sound,
        );
  }
}
