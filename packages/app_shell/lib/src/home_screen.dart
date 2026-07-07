import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'plugin_registry.dart';

/// Home hub. M0: wordmark, tool grid (from the registry), and the engine
/// smoke test — a button that plays the native test tone.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _tonePlaying = false;

  void _handleToneToggle() {
    final engine = ref.read(audioEngineProvider);
    setState(() => _tonePlaying = !_tonePlaying);
    engine.setTestTone(enabled: _tonePlaying);
  }

  @override
  Widget build(BuildContext context) {
    final plugins = ref.watch(toolPluginsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('KITBAG', style: theme.textTheme.headlineMedium),
              const SizedBox(height: 20),
              Expanded(
                child: plugins.isEmpty
                    ? _EmptyHub(
                        tonePlaying: _tonePlaying,
                        onToneToggle: _handleToneToggle,
                      )
                    : GridView.count(
                        crossAxisCount: 2,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        children: [
                          for (final plugin in plugins)
                            plugin.buildTile(
                              context,
                              onOpen: () => context.go(plugin.basePath),
                            ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyHub extends StatelessWidget {
  const _EmptyHub({required this.tonePlaying, required this.onToneToggle});

  final bool tonePlaying;
  final VoidCallback onToneToggle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'Tools arrive with the next milestones.\n'
            'For now: prove the audio core works.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: onToneToggle,
            icon: Icon(tonePlaying ? Icons.stop : Icons.play_arrow),
            label: Text(tonePlaying ? 'Stop tone' : 'Play 440 Hz tone'),
          ),
        ],
      ),
    );
  }
}
