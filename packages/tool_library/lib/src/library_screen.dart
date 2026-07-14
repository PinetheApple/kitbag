import 'dart:io';

import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_services/core_services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import 'library_state.dart';

/// Decodes an audio file in a background isolate and returns duration (s).
double _decodeDuration(String path) {
  final engine = AudioEngine.create()..start();
  try {
    final result = engine.decoder.open(path);
    return result?.$1 ?? 0;
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
                trailing: Text('.${song.format}',
                    style: Theme.of(context).textTheme.labelSmall),
              );
            },
          );
        },
      ),
    );
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

      // Decode audio metadata on a background isolate to avoid jank.
      double duration = 0;
      try {
        duration = await compute(_decodeDuration, dest.path);
      } catch (_) {
        // Non-fatal — song shows with 0:00 until manual fix.
      }

      await db.librarySongsDao.create(
        title: title,
        artist: artist,
        filePath: dest.path,
        duration: duration,
        format: format,
      );
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
