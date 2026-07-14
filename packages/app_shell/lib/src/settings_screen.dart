import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_db/core_db.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart' hide kitbagDatabaseProvider;
import 'package:core_services/core_services.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tool_metronome/tool_metronome.dart';

import 'plugin_registry.dart';
import 'settings_service.dart';

const _toolEnabledPrefix = 'tool_enabled_';

final toolEnabledProvider = FutureProvider.family<bool, String>((ref, id) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool('$_toolEnabledPrefix$id') ?? true;
});

final filteredToolPluginsProvider = Provider<List<ToolPlugin>>((ref) {
  final plugins = ref.watch(toolPluginsProvider);
  final results = <ToolPlugin>[];
  for (final plugin in plugins) {
    final enabled = ref.watch(toolEnabledProvider(plugin.id)).valueOrNull ?? true;
    if (enabled) {
      results.add(plugin);
    }
  }
  return results;
});

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final service = ref.watch(settingsServiceProvider);
    final baseDir = ref.watch(baseDirectoryFutureProvider);
    final plugins = ref.watch(toolPluginsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _Section(title: 'Storage', children: [
            _SettingTile(
              icon: Icons.folder_outlined,
              title: 'Base directory',
              subtitle: baseDir.when(
                data: (d) => d ?? 'Not set — tap to choose',
                loading: () => 'Loading...',
                error: (_, _) => 'Not set',
              ),
              onTap: () async {
                await service.pickBaseDirectory();
                ref.invalidate(baseDirectoryFutureProvider);
              },
            ),
            _SettingTile(
              icon: Icons.file_download_outlined,
              title: 'Export setlists & songs',
              subtitle: 'Back up or transfer your data',
              onTap: () async {
                final messenger = ScaffoldMessenger.of(context);
                try {
                  final path = await service.exportData();
                  messenger.showSnackBar(
                    SnackBar(content: Text('Exported to $path')),
                  );
                } catch (e) {
                  messenger.showSnackBar(
                    SnackBar(content: Text('Export failed: $e')),
                  );
                }
              },
            ),
            _SettingTile(
              icon: Icons.file_upload_outlined,
              title: 'Import setlists & songs',
              subtitle: 'Restore from a backup file',
              onTap: () async {
                final messenger = ScaffoldMessenger.of(context);
                try {
                  final result = await service.importData();
                  messenger.showSnackBar(SnackBar(content: Text(result)));
                } catch (e) {
                  messenger.showSnackBar(
                    SnackBar(content: Text('Import failed: $e')),
                  );
                }
              },
            ),
          ]),
          const SizedBox(height: 24),
          _Section(title: 'Audio', children: [
            _VolumeSlider(),
            _LatencySlider(),
          ]),
          const SizedBox(height: 24),
          _Section(title: 'Tools', children: [
            for (final plugin in plugins)
              _ToolToggle(plugin: plugin),
          ]),
          const SizedBox(height: 24),
          _Section(title: 'Practice', children: [
            _PracticeStatsTile(),
          ]),
          const SizedBox(height: 24),
          _Section(title: 'About', children: [
            _SettingTile(
              icon: Icons.info_outline,
              title: 'Kitbag',
              subtitle: 'Version 0.1.0',
              onTap: () {},
            ),
          ]),
        ],
      ),
    );
  }
}

class _VolumeSlider extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final volume = ref.watch(metronomeProvider.select((s) => s.volume));
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: KitbagRowCard(
        icon: Icons.volume_up_outlined,
        title: 'Volume boost',
        subtitle: '${(volume * 100).round()}%',
        trailing: SizedBox(
          width: 120,
          child: Slider(
            value: volume,
            min: MetronomeController.minVolume,
            max: MetronomeController.maxVolume,
            divisions: 20,
            onChanged: (v) => ref.read(metronomeProvider.notifier).setVolume(v),
          ),
        ),
      ),
    );
  }
}

class _LatencySlider extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final latency = ref.watch(metronomeProvider.select((s) => s.latencyOffsetMs));
    final label = latency == 0
        ? 'No offset'
        : '${latency > 0 ? '+' : ''}${latency.round()} ms';
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: KitbagRowCard(
        icon: Icons.tune_outlined,
        title: 'Latency correction',
        subtitle: label,
        trailing: SizedBox(
          width: 120,
          child: Slider(
            value: latency,
            min: MetronomeController.minLatencyMs,
            max: MetronomeController.maxLatencyMs,
            divisions: 20,
            onChanged: (v) =>
                ref.read(metronomeProvider.notifier).setLatencyOffset(v),
          ),
        ),
      ),
    );
  }
}

class _ToolToggle extends ConsumerWidget {
  const _ToolToggle({required this.plugin});

  final ToolPlugin plugin;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enabled = ref.watch(toolEnabledProvider(plugin.id)).valueOrNull ?? true;
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: KitbagRowCard(
        icon: plugin.icon,
        title: plugin.name,
        subtitle: enabled ? 'Visible on home screen' : 'Hidden from home screen',
        trailing: Switch(
          value: enabled,
          onChanged: (v) async {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setBool('$_toolEnabledPrefix${plugin.id}', v);
            ref.invalidate(toolEnabledProvider(plugin.id));
          },
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            title,
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.primary,
            ),
          ),
        ),
        ...children,
      ],
    );
  }
}

class _PracticeStatsTile extends ConsumerStatefulWidget {
  @override
  ConsumerState<_PracticeStatsTile> createState() => _PracticeStatsTileState();
}

class _PracticeStatsTileState extends ConsumerState<_PracticeStatsTile> {
  int? _totalSec;
  int? _count;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final db = ref.read(kitbagDatabaseProvider);
    final results = await Future.wait<int>([
      db.practiceDao.getTotalPracticeSeconds(),
      db.practiceDao.getSessionCount(),
    ]);
    if (mounted) setState(() { _totalSec = results[0]; _count = results[1]; });
  }

  @override
  Widget build(BuildContext context) {
    final db = ref.watch(kitbagDatabaseProvider);
    final totalMin = _totalSec != null ? _totalSec! ~/ 60 : null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: KitbagRowCard(
        icon: Icons.timer_outlined,
        title: 'Practice logs',
        subtitle: _count != null
            ? '$_count sessions · $totalMin min total'
            : 'Loading…',
        onTap: () => _showPracticeLogs(context, db),
      ),
    );
  }

  Future<void> _showPracticeLogs(BuildContext context, KitbagDatabase db) async {
    final sessions = await db.practiceDao.watchAll().first;
    if (!context.mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      constraints: const BoxConstraints(maxWidth: 480),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Practice sessions', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 12),
              if (sessions.isEmpty)
                const Text('No sessions yet — start the metronome to begin.')
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: sessions.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final s = sessions[i];
                      final min = s.durationSeconds ~/ 60;
                      final sec = s.durationSeconds % 60;
                      return ListTile(
                        dense: true,
                        leading: Text(
                          '${s.avgBpm.round()}',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        title: Text(
                          '${min.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}',
                        ),
                        subtitle: Text(
                          '${s.startTime.day}/${s.startTime.month}/${s.startTime.year}',
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SettingTile extends StatelessWidget {
  const _SettingTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: KitbagRowCard(
        icon: icon,
        title: title,
        subtitle: subtitle,
        onTap: onTap,
      ),
    );
  }
}
