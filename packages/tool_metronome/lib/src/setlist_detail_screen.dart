import 'dart:async';

import 'package:core_db/core_db.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'format.dart';
import 'metronome_routes.dart';
import 'metronome_state.dart';
import 'setlist_state.dart';

enum _SongAction { rename, recapture, delete }

/// One setlist: its ordered song presets. Songs are snapshots of the
/// metronome — dial the metronome in, then save it here; tapping a song
/// applies it back and starts the on-stage paging session.
class SetlistDetailScreen extends ConsumerWidget {
  const SetlistDetailScreen({super.key, required this.setlistId});

  static const double _maxContentWidth = 480;

  final int setlistId;

  SongsDao _songs(WidgetRef ref) => ref.read(kitbagDatabaseProvider).songsDao;

  Future<void> _addSong(BuildContext context, WidgetRef ref) async {
    final name = await promptForName(
      context,
      title: 'Save song preset',
      confirmLabel: 'Save',
    );
    if (name == null) {
      return;
    }
    final settings = ref.read(metronomeProvider);
    await _songs(ref).append(
      setlistId: setlistId,
      name: name,
      bpm: settings.bpm,
      beatsPerBar: settings.beatsPerBar,
      subdivision: settings.subdivision,
      accents: encodeAccents(settings.accents),
      polyEnabled: settings.polyEnabled,
      polyBeats: settings.polyBeats,
      sound: settings.sound,
      volume: settings.volume,
      latencyOffset: settings.latencyOffsetMs,
    );
  }

  Future<void> _renameSong(
    BuildContext context,
    WidgetRef ref,
    Song song,
  ) async {
    final name = await promptForName(
      context,
      title: 'Rename song',
      confirmLabel: 'Rename',
      initial: song.name,
    );
    if (name == null) {
      return;
    }
    await _songs(ref).updateSong(song.id, SongsCompanion(name: Value(name)));
  }

  Future<void> _recaptureSong(WidgetRef ref, Song song) {
    final settings = ref.read(metronomeProvider);
    return _songs(ref).updateSong(
      song.id,
      SongsCompanion(
        bpm: Value(settings.bpm),
        beatsPerBar: Value(settings.beatsPerBar),
        subdivision: Value(settings.subdivision),
        accents: Value(encodeAccents(settings.accents)),
        polyEnabled: Value(settings.polyEnabled),
        polyBeats: Value(settings.polyBeats),
        sound: Value(settings.sound),
        volume: Value(settings.volume),
        latencyOffset: Value(settings.latencyOffsetMs),
      ),
    );
  }

  void _play(
    BuildContext context,
    WidgetRef ref,
    Setlist setlist,
    List<Song> songs,
    int index,
  ) {
    ref
        .read(activeSetlistProvider.notifier)
        .play(setlist: setlist, songs: songs, index: index);
    context.go(MetronomeRoutes.metronome);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final setlist = ref.watch(setlistProvider(setlistId)).valueOrNull;
    final songs =
        ref.watch(setlistSongsProvider(setlistId)).valueOrNull ?? const [];
    return Scaffold(
      appBar: AppBar(title: Text(setlist?.name ?? 'Setlist')),
      floatingActionButton: songs.isEmpty
          ? null
          : FloatingActionButton(
              onPressed: () => _addSong(context, ref),
              tooltip: 'Save current metronome settings as a song',
              child: const Icon(Icons.add),
            ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _maxContentWidth),
            child: songs.isEmpty
                ? KitbagEmptyState(
                    icon: Icons.music_note,
                    title: 'No songs yet',
                    message:
                        'Dial in the metronome, then save it here as a '
                        'song preset — tempo, signature, accents, sound.',
                    actionLabel: 'Add current settings',
                    onAction: () => _addSong(context, ref),
                  )
                : ReorderableListView.builder(
                    buildDefaultDragHandles: false,
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                    itemCount: songs.length,
                    onReorderItem: (oldIndex, newIndex) {
                      unawaited(
                        _songs(ref).reorder(setlistId, oldIndex, newIndex),
                      );
                    },
                    itemBuilder: (context, index) {
                      final song = songs[index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _SongRow(
                          key: ValueKey(song.id),
                          song: song,
                          index: index,
                          onTap: setlist == null
                              ? null
                              : () => _play(context, ref, setlist, songs, index),
                          onRename: () => _renameSong(context, ref, song),
                          onRecapture: () => _recaptureSong(ref, song),
                          onDelete: () => _songs(ref).deleteSong(song.id),
                        ),
                      );
                    },
                  ),
          ),
        ),
      ),
    );
  }
}

class _SongRow extends StatelessWidget {
  const _SongRow({
    super.key,
    required this.song,
    required this.index,
    required this.onTap,
    required this.onRename,
    required this.onRecapture,
    required this.onDelete,
  });

  final Song song;
  final int index;
  final VoidCallback? onTap;
  final VoidCallback onRename;
  final Future<void> Function() onRecapture;
  final Future<void> Function() onDelete;

  @override
  Widget build(BuildContext context) {
    final dim = Theme.of(context).colorScheme.onSurfaceVariant;
    return KitbagRowCard(
      icon: Icons.music_note,
      title: song.name,
      subtitle: songSummary(song),
      onTap: onTap,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          PopupMenuButton<_SongAction>(
            tooltip: 'Song actions',
            onSelected: (action) => switch (action) {
              _SongAction.rename => onRename(),
              _SongAction.recapture => unawaited(onRecapture()),
              _SongAction.delete => unawaited(onDelete()),
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: _SongAction.rename, child: Text('Rename')),
              PopupMenuItem(
                value: _SongAction.recapture,
                child: Text('Overwrite with current settings'),
              ),
              PopupMenuItem(value: _SongAction.delete, child: Text('Delete')),
            ],
          ),
          ReorderableDragStartListener(
            index: index,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Icon(Icons.drag_handle, color: dim),
            ),
          ),
        ],
      ),
    );
  }
}
