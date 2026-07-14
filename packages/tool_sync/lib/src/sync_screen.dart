import 'dart:async';

import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:core_services/core_services.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'bpm_lookup_service.dart';
import 'media_session_service.dart';
import 'sync_state.dart';

final _bpmLookupProvider = Provider<BpmLookupService>((ref) => BpmLookupService());

const _clickSoundNames = [
  'Default', 'Wood block', 'Rim shot', 'Tom', 'Hi-hat', 'Cowbell',
];

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
      final track = sessions.isNotEmpty ? sessions.first : null;
      ref.read(activeTrackProvider.notifier).state = track;

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
    final dao = ref.read(librarySongsDaoProvider);
    final match = await dao.searchByTitleArtist(title, artist);
    if (match != null && match.bpm != null && match.beatGrid != null) {
      ref.read(detectedBpmProvider.notifier).state = match.bpm!;
      return;
    }

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
                      'Play a song on Spotify, YouTube, or any music app, '
                      'then enable Notification Listener access in System Settings.',
                      style: Theme.of(context).textTheme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // BPM + Lock
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('BPM', style: Theme.of(context).textTheme.labelMedium),
                      if (detectedBpm > 0)
                        Text(
                          detectedBpm.toStringAsFixed(1),
                          style: Theme.of(context)
                              .textTheme
                              .headlineLarge
                              ?.copyWith(fontWeight: FontWeight.bold),
                        )
                      else
                        Text('--',
                            style: Theme.of(context).textTheme.headlineLarge),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Slider(
                          value: detectedBpm.clamp(20.0, 400.0),
                          min: 20,
                          max: 400,
                          divisions: 380,
                          label: '${detectedBpm.round()} BPM',
                          onChanged: (v) {
                            ref.read(detectedBpmProvider.notifier).state = v;
                            if (isLocked) metronome.setTempo(v);
                          },
                        ),
                      ),
                      Text('400', style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      OutlinedButton.icon(
                        icon: const Icon(Icons.tap_and_play, size: 18),
                        label: const Text('Tap'),
                        onPressed: () {
                          final bpm = bpmLookup.tap();
                          if (bpm != null) {
                            ref.read(detectedBpmProvider.notifier).state = bpm;
                            if (isLocked) metronome.setTempo(bpm);
                          }
                        },
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: () => bpmLookup.resetTap(),
                        child: const Text('Reset'),
                      ),
                      const SizedBox(width: 8),
                      if (activeTrack != null)
                        TextButton.icon(
                          icon: const Icon(Icons.cloud_download, size: 16),
                          label: const Text('Online'),
                          onPressed: () =>
                              _lookupBpm(activeTrack.title, activeTrack.artist),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      icon: Icon(
                        isLocked ? Icons.sync : Icons.sync_disabled,
                        size: 20,
                      ),
                      label: Text(isLocked ? 'Phase locked' : 'Lock phase'),
                      onPressed: () {
                        ref.read(isPhaseLockedProvider.notifier).state =
                            !isLocked;
                        if (!isLocked) {
                          metronome.setTempo(
                              detectedBpm.clamp(20.0, 400.0));
                          metronome.start();
                        } else {
                          metronome.stop();
                        }
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Time signature & subdivision
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Time signature',
                      style: Theme.of(context).textTheme.labelMedium),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Text('Beats per bar'),
                      const Spacer(),
                      SizedBox(
                        width: 160,
                        child: Slider(
                          value: 4,
                          min: 1,
                          max: 16,
                          divisions: 15,
                          label: '${4}',
                          onChanged: (v) => metronome.setBeatsPerBar(v.round()),
                        ),
                      ),
                      Text('16', style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Text('Subdivision'),
                      const Spacer(),
                      SizedBox(
                        width: 160,
                        child: Slider(
                          value: 1,
                          min: 1,
                          max: 16,
                          divisions: 15,
                          label: '${1}',
                          onChanged: (v) =>
                              metronome.setSubdivision(v.round()),
                        ),
                      ),
                      Text('16', style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Volume & Sound
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Sound', style: Theme.of(context).textTheme.labelMedium),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.volume_up, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Slider(
                          value: 1.0,
                          min: 0,
                          max: 2,
                          divisions: 40,
                          label: '${(1.0).toStringAsFixed(2)}x',
                          onChanged: (v) => metronome.setVolume(v),
                        ),
                      ),
                      Text('2x', style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<int>(
                    initialValue: 0,
                    decoration: const InputDecoration(
                      labelText: 'Click sound',
                      contentPadding: EdgeInsets.symmetric(horizontal: 12),
                    ),
                    items: List.generate(
                      _clickSoundNames.length,
                      (i) => DropdownMenuItem(value: i, child: Text(_clickSoundNames[i])),
                    ),
                    onChanged: (v) {
                      if (v != null) metronome.setSound(v);
                    },
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
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'To detect media from other apps, enable Notification '
                          'Listener access in System Settings → Apps → Special '
                          'app access → Notification access.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
