import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
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
