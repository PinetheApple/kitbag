import 'dart:io';
import 'dart:typed_data';

import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_db/core_db.dart';
import 'package:core_services/core_services.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'stems_state.dart';

class StemsSetScreen extends ConsumerStatefulWidget {
  const StemsSetScreen({super.key, required this.stemSet});

  final StemSet stemSet;

  @override
  ConsumerState<StemsSetScreen> createState() => _StemsSetScreenState();
}

class _StemsSetScreenState extends ConsumerState<StemsSetScreen>
    with SingleTickerProviderStateMixin {
  bool _loaded = false;
  bool _playing = false;
  int _positionMs = 0;
  late Ticker _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick)..start();
    _loadStems();
  }

  @override
  void dispose() {
    _ticker.dispose();
    final mixer = ref.read(mixerControllerProvider);
    mixer.stop();
    super.dispose();
  }

  Future<void> _loadStems() async {
    final dao = ref.read(stemsDaoProvider);
    final stems = await dao.watchStems(widget.stemSet.id).first;
    final mixer = ref.read(mixerControllerProvider);

    for (int i = 0; i < stems.length; i++) {
      final stem = stems[i];
      final file = File(stem.filePath);
      if (!file.existsSync()) continue;

      // Decode stem PCM data
      final pcm = await _decodeFile(stem.filePath);
      if (pcm == null) continue;

      mixer.setTrackData(i, pcm, stem.channelCount > 0 ? stem.channelCount : 2,
          stem.sampleRate > 0 ? stem.sampleRate : 48000);

      // Restore gain/mute/solo state
      if (stem.gain != 1.0) mixer.setGain(i, stem.gain);
      if (stem.muted) mixer.setMuted(i, true);
      if (stem.soloed) mixer.setSoloed(i, true);
    }

    setState(() => _loaded = true);
  }

  Future<Float32List?> _decodeFile(String path) async {
    final engine = AudioEngine.create()..start();
    try {
      final meta = engine.decoder.open(path);
      if (meta == null) return null;
      // For now, we don't have a full PCM decode API in Dart.
      // Read frames via the native decoder.
      return null; // Placeholder
    } finally {
      engine.dispose();
    }
  }

  void _onTick(Duration _) {
    if (!mounted) return;
    final mixer = ref.read(mixerControllerProvider);
    final playing = mixer.isPlaying;
    if (playing != _playing) {
      setState(() => _playing = playing);
    }
    if (playing) {
      final pos = mixer.position;
      setState(() => _positionMs = pos);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stemsAsync = ref.watch(stemsForSetProvider(widget.stemSet.id));
    final mixer = ref.read(mixerControllerProvider);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: Text(widget.stemSet.name)),
      body: stemsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (stems) {
          if (stems.isEmpty) {
            return const Center(child: Text('No stems in this set'));
          }
          return Column(
            children: [
              // Transport bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    IconButton(
                      icon: Icon(
                        _playing ? Icons.pause_circle : Icons.play_circle,
                        size: 40,
                      ),
                      onPressed: () {
                        if (_playing) {
                          mixer.stop();
                        } else {
                          mixer.play();
                        }
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.stop, size: 28),
                      onPressed: () => mixer.stop(),
                    ),
                    if (_loaded)
                      Text(
                        '${_positionMs ~/ 48000}:${((_positionMs % 48000) * 1000 ~/ 48000).toString().padLeft(2, '0')}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                  ],
                ),
              ),
              // Track list with gain/mute/solo
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  itemCount: stems.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final stem = stems[i];
                    final muted = _loaded && mixer.getMuted(i);
                    final soloed = _loaded && mixer.getSoloed(i);
                    final gain = _loaded ? mixer.getGain(i) : 1.0;

                    return ListTile(
                      leading: Icon(
                        _roleIcon(stem.role),
                        color: muted ? Colors.grey : null,
                        size: 28,
                      ),
                      title: Text(
                        _roleLabel(stem.role),
                        style: TextStyle(
                          decoration: muted ? TextDecoration.lineThrough : null,
                          color: muted ? Colors.grey : null,
                        ),
                      ),
                      subtitle: Row(
                        children: [
                          Text(
                            '${stem.format} · ${_fmtDuration(stem.duration)}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          const Spacer(),
                          // Gain slider
                          SizedBox(
                            width: 80,
                            child: Slider(
                              value: gain,
                              min: 0,
                              max: 2,
                              onChanged: (v) {
                                mixer.setGain(i, v);
                                ref.read(stemsDaoProvider).updateGain(stem.id, v);
                              },
                            ),
                          ),
                        ],
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: Icon(Icons.volume_up,
                                color: muted ? Colors.grey : scheme.primary,
                                size: 20),
                            onPressed: () {
                              mixer.setMuted(i, !muted);
                              ref.read(stemsDaoProvider).toggleMute(stem.id);
                            },
                          ),
                          IconButton(
                            icon: Icon(Icons.headphones,
                                color: soloed ? scheme.primary : Colors.grey,
                                size: 20),
                            onPressed: () {
                              mixer.setSoloed(i, !soloed);
                              ref.read(stemsDaoProvider).toggleSolo(stem.id);
                            },
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
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
