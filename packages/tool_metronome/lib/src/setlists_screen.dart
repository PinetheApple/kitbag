import 'package:core_db/core_db.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'metronome_routes.dart';
import 'setlist_state.dart';

enum _SetlistAction { rename, delete }

/// All setlists. Rows open the setlist editor; the empty state is the
/// create action.
class SetlistsScreen extends ConsumerWidget {
  const SetlistsScreen({super.key});

  static const double _maxContentWidth = 480;

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final name = await promptForName(
      context,
      title: 'New setlist',
      confirmLabel: 'Create',
    );
    if (name == null) {
      return;
    }
    await ref.read(kitbagDatabaseProvider).setlistsDao.create(name);
  }

  Future<void> _rename(
    BuildContext context,
    WidgetRef ref,
    Setlist setlist,
  ) async {
    final name = await promptForName(
      context,
      title: 'Rename setlist',
      confirmLabel: 'Rename',
      initial: setlist.name,
    );
    if (name == null) {
      return;
    }
    await ref.read(kitbagDatabaseProvider).setlistsDao.rename(setlist.id, name);
  }

  Future<void> _delete(
    BuildContext context,
    WidgetRef ref,
    Setlist setlist,
  ) async {
    final confirmed = await confirmDelete(
      context,
      title: 'Delete "${setlist.name}"?',
      message: 'Its song presets are deleted with it.',
    );
    if (!confirmed) {
      return;
    }
    // The active session watches the database and ends itself if this was
    // the active setlist — no clearing needed here.
    await ref
        .read(kitbagDatabaseProvider)
        .setlistsDao
        .deleteSetlist(setlist.id);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final setlists = ref.watch(setlistsProvider);
    final summaries = setlists.valueOrNull;
    return Scaffold(
      appBar: AppBar(title: const Text('Setlists')),
      floatingActionButton: summaries == null || summaries.isEmpty
          ? null
          : FloatingActionButton(
              onPressed: () => _create(context, ref),
              tooltip: 'New setlist',
              child: const Icon(Icons.add),
            ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _maxContentWidth),
            child: summaries == null
                ? const SizedBox.shrink()
                : summaries.isEmpty
                ? KitbagEmptyState(
                    icon: Icons.queue_music,
                    title: 'No setlists yet',
                    message:
                        'Group song presets into a setlist and page '
                        'through them on stage.',
                    actionLabel: 'Create a setlist',
                    onAction: () => _create(context, ref),
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                    children: [
                      for (final summary in summaries)
                        _SetlistRow(
                          summary: summary,
                          onRename: () =>
                              _rename(context, ref, summary.setlist),
                          onDelete: () =>
                              _delete(context, ref, summary.setlist),
                        ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _SetlistRow extends StatelessWidget {
  const _SetlistRow({
    required this.summary,
    required this.onRename,
    required this.onDelete,
  });

  final SetlistSummary summary;
  final VoidCallback onRename;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final count = summary.songCount;
    return KitbagRowCard(
      icon: Icons.queue_music,
      title: summary.setlist.name,
      subtitle: '$count ${count == 1 ? 'song' : 'songs'}',
      onTap: () => context.go(MetronomeRoutes.setlist(summary.setlist.id)),
      trailing: PopupMenuButton<_SetlistAction>(
        tooltip: 'Setlist actions',
        onSelected: (action) => switch (action) {
          _SetlistAction.rename => onRename(),
          _SetlistAction.delete => onDelete(),
        },
        itemBuilder: (context) => const [
          PopupMenuItem(value: _SetlistAction.rename, child: Text('Rename')),
          PopupMenuItem(value: _SetlistAction.delete, child: Text('Delete')),
        ],
      ),
    );
  }
}
