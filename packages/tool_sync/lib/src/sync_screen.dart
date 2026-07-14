import 'dart:async';

import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'media_session_service.dart';
import 'sync_state.dart';

class SyncScreen extends ConsumerStatefulWidget {
  const SyncScreen({super.key});

  @override
  ConsumerState<SyncScreen> createState() => _SyncScreenState();
}

class _SyncScreenState extends ConsumerState<SyncScreen> {
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _startPolling();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      final sessions = await MediaSessionService.getActiveSessions();
      if (!mounted) return;
      if (sessions.isNotEmpty) {
        ref.read(activeTrackProvider.notifier).state = sessions.first;
      } else {
        ref.read(activeTrackProvider.notifier).state = null;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final activeTrack = ref.watch(activeTrackProvider);
    final detectedBpm = ref.watch(detectedBpmProvider);
    final isLocked = ref.watch(isPhaseLockedProvider);
    final offsetMs = ref.watch(phaseOffsetMsProvider);
    final metronome = ref.watch(metronomeControllerProvider);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Media Sync')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Now-playing card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Icon(Icons.music_note, size: 48, color: scheme.primary),
                  const SizedBox(height: 12),
                  if (activeTrack != null) ...[
                    Text(activeTrack.title,
                        style: Theme.of(context).textTheme.titleLarge,
                        textAlign: TextAlign.center),
                    const SizedBox(height: 4),
                    Text(activeTrack.artist,
                        style: Theme.of(context).textTheme.bodyMedium,
                        textAlign: TextAlign.center),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          activeTrack.isPlaying
                              ? Icons.play_arrow
                              : Icons.pause,
                          size: 16,
                          color: scheme.primary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          activeTrack.isPlaying ? 'Playing' : 'Paused',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ] else ...[
                    Text('No media detected',
                        style: Theme.of(context).textTheme.bodyLarge),
                    const SizedBox(height: 8),
                    Text(
                      'Play a song on Spotify, YouTube, or any music app — '
                      'then sync the metronome here.',
                      style: Theme.of(context).textTheme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // BPM display + tap tempo
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Text('BPM', style: Theme.of(context).textTheme.labelMedium),
                  const SizedBox(height: 8),
                  Text(
                    detectedBpm > 0
                        ? detectedBpm.toStringAsFixed(1)
                        : '--',
                    style: Theme.of(context)
                        .textTheme
                        .headlineLarge
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      OutlinedButton.icon(
                        icon: const Icon(Icons.tap_and_play, size: 18),
                        label: const Text('Tap tempo'),
                        onPressed: () {
                          // Placeholder: tap tempo would go here
                        },
                      ),
                      const SizedBox(width: 12),
                      FilledButton.icon(
                        icon: Icon(
                          isLocked ? Icons.sync : Icons.sync_disabled,
                          size: 18,
                        ),
                        label: Text(isLocked ? 'Locked' : 'Lock phase'),
                        onPressed: () {
                          if (metronome.currentBpm <= 0 && detectedBpm > 0) {
                            metronome.setTempo(detectedBpm);
                          }
                          metronome.start();
                          ref.read(isPhaseLockedProvider.notifier).state =
                              !isLocked;
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Phase alignment (nudge)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Phase offset',
                          style: Theme.of(context).textTheme.labelMedium),
                      Text('${offsetMs.toStringAsFixed(0)} ms',
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.chevron_left),
                        onPressed: () {
                          final current = ref.read(phaseOffsetMsProvider);
                          ref.read(phaseOffsetMsProvider.notifier).state =
                              (current - 5).clamp(-100, 100);
                          metronome.setLatencyOffset(
                              ref.read(phaseOffsetMsProvider));
                        },
                      ),
                      Expanded(
                        child: Slider(
                          value: offsetMs,
                          min: -100,
                          max: 100,
                          divisions: 40,
                          label: '${offsetMs.round()} ms',
                          onChanged: (v) {
                            ref.read(phaseOffsetMsProvider.notifier).state = v;
                            metronome.setLatencyOffset(v);
                          },
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.chevron_right),
                        onPressed: () {
                          final current = ref.read(phaseOffsetMsProvider);
                          ref.read(phaseOffsetMsProvider.notifier).state =
                              (current + 5).clamp(-100, 100);
                          metronome.setLatencyOffset(
                              ref.read(phaseOffsetMsProvider));
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Permission explainer
          if (activeTrack == null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Enable Notification Access in System Settings → '
                        'Apps → Kitbag → Notification Access to detect '
                        'media from other apps.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
