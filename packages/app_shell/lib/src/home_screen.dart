import 'package:core_design/core_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'plugin_registry.dart';

/// Home hub per the design spec: wordmark, Continue card, 2-wide tool grid
/// (upcoming tools visible but muted — the plugin roster is part of the UI),
/// then row cards for later feature groups.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  static const double _maxContentWidth = 480;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plugins = ref.watch(toolPluginsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _maxContentWidth),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Row(
                  children: [
                    Text(
                      'KITBAG',
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: null,
                      tooltip: 'Settings — coming soon',
                      icon: Icon(
                        Icons.settings_outlined,
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (plugins.isNotEmpty) const _ContinueCard(),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.45,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    for (final plugin in plugins)
                      plugin.buildTile(
                        context,
                        onOpen: () => context.go(plugin.basePath),
                      ),
                    const KitbagToolTile(
                      icon: Icons.graphic_eq,
                      name: 'Tuner',
                      subtitle: 'Next milestone',
                      enabled: false,
                    ),
                    const KitbagToolTile(
                      icon: Icons.library_music_outlined,
                      name: 'Songs',
                      subtitle: 'Coming soon',
                      enabled: false,
                    ),
                    const KitbagToolTile(
                      icon: Icons.stacked_line_chart,
                      name: 'Stems',
                      subtitle: 'Coming soon',
                      enabled: false,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const KitbagRowCard(
                  icon: Icons.radio_button_checked,
                  title: 'Play along',
                  subtitle: 'Sync to Spotify & more — coming soon',
                  enabled: false,
                ),
                const SizedBox(height: 12),
                const KitbagRowCard(
                  icon: Icons.auto_awesome_outlined,
                  title: 'More tools',
                  subtitle: 'Practice log, stem split — future plugins',
                  enabled: false,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ContinueCard extends StatelessWidget {
  const _ContinueCard();

  @override
  Widget build(BuildContext context) {
    return KitbagRowCard(
      icon: Icons.av_timer,
      title: 'Continue · Metronome',
      subtitle: 'Pick up where you left off',
      highlighted: true,
      onTap: () => context.go('/metronome'),
      trailing: Icon(
        Icons.play_arrow,
        color: Theme.of(context).colorScheme.primary,
      ),
    );
  }
}
