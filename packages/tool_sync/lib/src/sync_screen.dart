import 'dart:async';

import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:core_services/core_services.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'bpm_lookup_service.dart';
import 'media_session_service.dart';
import 'sync_state.dart';

final _bpmLookupProvider = Provider<BpmLookupService>((ref) => BpmLookupService());

class SyncScreen extends ConsumerStatefulWidget {
  const SyncScreen({super.key});

  @override
  ConsumerState<SyncScreen> createState() => _SyncScreenState();
}

class _SyncScreenState extends ConsumerState<SyncScreen> {
  Timer? _pollTimer;
  String? _lastTrackKey;

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
      final track =
          sessions.isNotEmpty ? sessions.first : null;
      ref.read(activeTrackProvider.notifier).state = track;

      // Auto-lookup BPM when a new track appears
      if (track != null) {
        final key = '${track.title}|${track.artist}';
        if (key != _lastTrackKey) {
          _lastTrackKey = key;
          await _lookupBpm(track.title, track.artist);
        }
      } else {
        _lastTrackKey = null;
      }
    });
  }

  Future<void> _lookupBpm(String title, String artist) async {
    // 1. Check library first (already analyzed)
    final dao = ref.read(librarySongsDaoProvider);
    final match = await dao.searchByTitleArtist(title, artist);
    if (match != null && match.bpm != null && match.beatGrid != null) {
      ref.read(detectedBpmProvider.notifier).state = match.bpm!;
      return;
    }

    // 2. Online lookup
    final service = ref.read(_bpmLookupProvider);
    final bpm = await service.lookup(title, artist);
    if (bpm != null && mounted) {
      ref.read(detectedBpmProvider.notifier).state = bpm;
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeTrack = ref.watch(activeTrackProvider);
    final detectedBpm = ref.watch(detectedBpmProvider);
    final isLocked = ref.watch(isPhaseLockedProvider);
    final offsetMs = ref.watch(phaseOffsetMsProvider);
    final metronome = ref.watch(metronomeControllerProvider);
    final bpmLookup = ref.read(_bpmLookupProvider);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Media Sync')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
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

          // BPM display + lookup/tap
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
                          final bpm = bpmLookup.tap();
                          if (bpm != null) {
                            ref.read(detectedBpmProvider.notifier).state = bpm;
                          }
                        },
                      ),
                      const SizedBox(width: 12),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.refresh, size: 18),
                        label: const Text('Reset taps'),
                        onPressed: () => bpmLookup.resetTap(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (activeTrack != null)
                    TextButton.icon(
                      icon: const Icon(Icons.cloud_download, size: 16),
                      label: const Text('Lookup online'),
                      onPressed: () =>
                          _lookupBpm(activeTrack.title, activeTrack.artist),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Lock-phase button
          if (detectedBpm > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: Icon(
                    isLocked ? Icons.sync : Icons.sync_disabled,
                    size: 20,
                  ),
                  label: Text(isLocked ? 'Phase locked' : 'Lock phase'),
                  onPressed: () {
                    ref.read(isPhaseLockedProvider.notifier).state = !isLocked;
                    if (!isLocked) {
                      metronome.setTempo(detectedBpm);
                      metronome.start();
                    } else {
                      metronome.stop();
                    }
                  },
                ),
              ),
            ),

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
                          },
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.chevron_right),
                        onPressed: () {
                          final current = ref.read(phaseOffsetMsProvider);
                          ref.read(phaseOffsetMsProvider.notifier).state =
                              (current + 5).clamp(-100, 100);
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
