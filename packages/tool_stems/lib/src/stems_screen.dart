import 'dart:io';

import 'package:core_db/core_db.dart';
import 'package:core_services/core_services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';

import 'stems_state.dart';

/// Matches a filename to a stem role based on common naming patterns.
String matchStemRole(String filename) {
  final lower = filename.toLowerCase();
  if (lower.contains('vocal') || lower.contains('vox') || lower.contains('voice')) {
    return 'vocals';
  }
  if (lower.contains('drum') || lower.contains('drumkit') || lower.contains('perc')) {
    return 'drums';
  }
  if (lower == 'bass' || lower.startsWith('bass') || lower.contains('bass.')) {
    return 'bass';
  }
  if (lower.contains('guitar') || lower.contains('gtr')) {
    return 'guitar';
  }
  if (lower.contains('piano') || lower.contains('keys') || lower.contains('keyboard') || lower.contains('synth')) {
    return 'keys';
  }
  return 'other';
}

class StemsScreen extends ConsumerWidget {
  const StemsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stemSetsAsync = ref.watch(stemSetsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Stems'),
        actions: [
          IconButton(
            icon: const Icon(Icons.create_new_folder),
            tooltip: 'Import stem folder',
            onPressed: () => _importStems(context, ref),
          ),
        ],
      ),
      body: stemSetsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (sets) {
          if (sets.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.grid_view, size: 64),
                  const SizedBox(height: 16),
                  const Text('Import a stem folder to get started'),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    icon: const Icon(Icons.create_new_folder),
                    label: const Text('Import stem folder'),
                    onPressed: () => _importStems(context, ref),
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: sets.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final set = sets[i];
              return ListTile(
                leading: const Icon(Icons.grid_view),
                title: Text(set.name),
                subtitle: Text(_formatDate(set.createdAt)),
                onTap: () => _openStemSet(context, ref, set),
              );
            },
          );
        },
      ),
    );
  }

  String _formatDate(DateTime dt) {
    return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
  }

  Future<void> _importStems(BuildContext context, WidgetRef ref) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['wav', 'mp3', 'flac', 'ogg', 'aac', 'm4a'],
      allowMultiple: true,
    );
    if (result == null || result.files.isEmpty) return;

    final db = ref.read(kitbagDatabaseProvider);
    final dir = await getApplicationDocumentsDirectory();
    final stemsDir = Directory('${dir.path}/stems');
    if (!await stemsDir.exists()) {
      await stemsDir.create(recursive: true);
    }

    // Use the containing folder name if available, else timestamp
    final firstPath = result.files.first.path;
    final folderName = firstPath != null
        ? File(firstPath).parent.path.split('/').last
        : 'Stems ${DateTime.now().millisecondsSinceEpoch}';

    final setId = await db.stemsDao.createSet(name: folderName);
    final setDir = Directory('${stemsDir.path}/$setId');
    await setDir.create(recursive: true);

    var imported = 0;
    for (final file in result.files) {
      if (file.path == null) continue;
      final source = File(file.path!);
      final format = file.extension?.toLowerCase() ?? 'unknown';
      final destPath = '${setDir.path}/${file.name}';
      await source.copy(destPath);

      final role = matchStemRole(file.name);
      final duration = 0.0; // Will be decoded later
      final channelCount = 0;
      final sampleRate = 0;

      await db.stemsDao.createStem(
        stemSetId: setId,
        role: role,
        filePath: destPath,
        duration: duration,
        format: format,
        channelCount: channelCount,
        sampleRate: sampleRate,
        sortOrder: imported,
      );
      imported++;
    }

    if (!context.mounted) return;
    ref.invalidate(stemSetsProvider);

    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Imported $imported stem(s) as $folderName')),
    );
  }

  void _openStemSet(BuildContext context, WidgetRef ref, StemSet set) {
    context.push('/stems/stems/set', extra: set);
  }
}
