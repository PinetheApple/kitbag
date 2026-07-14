import 'package:core_db/core_db.dart';
import 'package:core_services/core_services.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'stems_state.dart';

class StemsSetScreen extends ConsumerWidget {
  const StemsSetScreen({super.key, required this.stemSet});

  final StemSet stemSet;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stemsAsync = ref.watch(stemsForSetProvider(stemSet.id));

    return Scaffold(
      appBar: AppBar(title: Text(stemSet.name)),
      body: stemsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (stems) {
          if (stems.isEmpty) {
            return const Center(child: Text('No stems in this set'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: stems.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final stem = stems[i];
              final scheme = Theme.of(context).colorScheme;
              return ListTile(
                leading: Icon(
                  _roleIcon(stem.role),
                  color: stem.muted ? Colors.grey : null,
                ),
                title: Text(
                  _roleLabel(stem.role),
                  style: TextStyle(
                    decoration: stem.muted ? TextDecoration.lineThrough : null,
                    color: stem.muted ? Colors.grey : null,
                  ),
                ),
                subtitle: Text('${stem.format} · ${_fmtDuration(stem.duration)}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: Icon(
                        Icons.volume_up,
                        color: stem.muted ? Colors.grey : scheme.primary,
                        size: 20,
                      ),
                      onPressed: () => ref.read(stemsDaoProvider).toggleMute(stem.id),
                    ),
                    IconButton(
                      icon: Icon(
                        Icons.headphones,
                        color: stem.soloed ? scheme.primary : Colors.grey,
                        size: 20,
                      ),
                      onPressed: () => ref.read(stemsDaoProvider).toggleSolo(stem.id),
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

  IconData _roleIcon(String role) {
    switch (role) {
      case 'vocals': return Icons.mic;
      case 'drums': return Icons.dashboard;
      case 'bass': return Icons.music_note;
      case 'guitar': return Icons.music_video;
      case 'keys': return Icons.piano;
      default: return Icons.audiotrack;
    }
  }

  String _roleLabel(String role) {
    switch (role) {
      case 'vocals': return 'Vocals';
      case 'drums': return 'Drums';
      case 'bass': return 'Bass';
      case 'guitar': return 'Guitar';
      case 'keys': return 'Keys';
      default: return 'Other';
    }
  }

  String _fmtDuration(double sec) {
    final m = (sec ~/ 60).toString().padLeft(2, '0');
    final s = (sec % 60).toStringAsFixed(0).padLeft(2, '0');
    return '$m:$s';
  }
}
