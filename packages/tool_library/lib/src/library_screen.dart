import 'dart:io';

import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_db/core_db.dart';
import 'package:core_services/core_services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';

import 'library_state.dart';

/// Result of analyzing a song in a background isolate.
class _AnalysisResult {
  final double duration;
  final double bpm;
  final Float32List beatTimes;
  final String? waveformPath;
  _AnalysisResult({
    required this.duration,
    required this.bpm,
    required this.beatTimes,
    this.waveformPath,
  });
}

/// Analyzes a song file in a background isolate.
/// Returns duration, BPM, beat times, and waveform sidecar path.
_AnalysisResult _analyzeSong(String path) {
  final engine = AudioEngine.create()..start();
  try {
    // Get duration first
    final meta = engine.decoder.open(path);
    final duration = meta?.$1 ?? 0.0;

    // Run beat analysis and waveform generation
    final musicDir = Directory(path).parent.path;
    final result = engine.decoder.analyzeSong(path, waveformDir: musicDir);

    if (result != null) {
      return _AnalysisResult(
        duration: duration,
        bpm: result.$1,
        beatTimes: result.$2,
        waveformPath: result.$3,
      );
    }
    return _AnalysisResult(duration: duration, bpm: 0, beatTimes: Float32List(0));
  } finally {
    engine.dispose();
  }
}

/// Thrown when decoding an imported song fails — non-fatal, song still shows
/// with duration 0.
class DecodeException implements Exception {
  DecodeException(this.path, this.message);
  final String path;
  final String message;
  @override
  String toString() => 'DecodeException($path: $message)';
}

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final songsAsync = ref.watch(librarySongsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Library'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'Import songs',
            onPressed: () => _importSongs(context, ref),
          ),
        ],
      ),
      body: songsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (songs) {
          if (songs.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.library_music_outlined,
                      size: 64, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(height: 16),
                  Text('Import songs to get started',
                      style: Theme.of(context).textTheme.bodyLarge),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    icon: const Icon(Icons.add),
                    label: const Text('Import from device'),
                    onPressed: () => _importSongs(context, ref),
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: songs.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final song = songs[i];
              final min = Duration(seconds: song.duration.round()).inMinutes;
              final sec = song.duration.round() % 60;
              return ListTile(
                leading: const Icon(Icons.audiotrack),
                title: Text(song.title),
                subtitle: Text(
                  '${song.artist} · $min:${sec.toString().padLeft(2, '0')}',
                ),
                trailing: PopupMenuButton<String>(
                  onSelected: (v) {
                    if (v == 'play') {
                      context.push('/library/player', extra: song);
                    } else if (v == 'play-along') {
                      context.push('/library/play-along', extra: song);
                    } else if (v == 'delete') {
                      _deleteSong(context, ref, song);
                    }
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(
                      value: 'play',
                      child: ListTile(
                        leading: Icon(Icons.play_arrow),
                        title: Text('Play'),
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'play-along',
                      child: ListTile(
                        leading: Icon(Icons.speed),
                        title: Text('Play along'),
                      ),
                    ),
                    const PopupMenuDivider(),
                    const PopupMenuItem(
                      value: 'delete',
                      child: ListTile(
                        leading: Icon(Icons.delete_outline),
                        title: Text('Delete'),
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _deleteSong(BuildContext context, WidgetRef ref, LibrarySong song) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete song'),
        content: Text('Remove "${song.title}" from the library?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Delete', style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final db = ref.read(kitbagDatabaseProvider);
    await db.librarySongsDao.deleteSong(song.id);
    ref.invalidate(librarySongsProvider);
    final count = await db.librarySongsDao.getCount();
    ref.read(libraryProvider.notifier).setSongCount(count);
  }

  Future<void> _importSongs(BuildContext context, WidgetRef ref) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['wav', 'mp3', 'flac', 'ogg', 'aac', 'm4a'],
      allowMultiple: true,
    );
    if (result == null || result.files.isEmpty) return;

    final db = ref.read(kitbagDatabaseProvider);
    final dir = await getApplicationDocumentsDirectory();
    final musicDir = Directory('${dir.path}/music');
    if (!await musicDir.exists()) {
      await musicDir.create(recursive: true);
    }

    var imported = 0;
    for (final file in result.files) {
      if (file.path == null) continue;
      final source = File(file.path!);
      final format = file.extension?.toLowerCase() ?? 'unknown';
      final dest = File('${musicDir.path}/${file.name}');
      await source.copy(dest.path);

      final title = file.name.split('.').first;
      final artist = 'Unknown';

      // Analyze song in background isolate for duration + beat grid + waveform.
      _AnalysisResult analysis;
      try {
        analysis = await compute(_analyzeSong, dest.path);
      } catch (_) {
        analysis = _AnalysisResult(duration: 0, bpm: 0, beatTimes: Float32List(0));
      }

      final songId = await db.librarySongsDao.create(
        title: title,
        artist: artist,
        filePath: dest.path,
        duration: analysis.duration,
        format: format,
      );

      // Store beat analysis results if we got any beats
      if (analysis.bpm > 0 && analysis.beatTimes.isNotEmpty) {
        final beatBytes = analysis.beatTimes.buffer.asUint8List();
        await db.librarySongsDao.updateAnalysis(
          id: songId,
          bpm: analysis.bpm,
          beatGrid: beatBytes,
          waveformPath: analysis.waveformPath,
        );
      }
      imported++;
    }

    if (!context.mounted) return;
    ref.invalidate(librarySongsProvider);
    final count = await db.librarySongsDao.getCount();
    ref.read(libraryProvider.notifier).setSongCount(count);

    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Imported $imported song(s)')),
    );
  }
}
