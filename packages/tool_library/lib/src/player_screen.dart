import 'dart:io';
import 'dart:typed_data';

import 'package:core_db/core_db.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'beat_sync_service.dart';
import 'player_state.dart';
import 'waveform_painter.dart';

class PlayerScreen extends ConsumerStatefulWidget {
  const PlayerScreen({super.key, required this.song});

  final LibrarySong song;

  @override
  ConsumerState<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends ConsumerState<PlayerScreen> {
  List<List<PeakPair>> _peaks = [];
  bool _peaksLoaded = false;
  Float32List? _beatGrid;
  double _bpm = 0;

  @override
  void initState() {
    super.initState();
    _loadWaveform();
    _loadBeatGrid();
    _initPlayer();
  }

  void _initPlayer() async {
    final player = ref.read(playerProvider);
    await player.setFilePath(widget.song.filePath);
  }

  void _loadWaveform() {
    if (widget.song.waveformPath == null) return;
    final path = widget.song.waveformPath!;
    if (!File(path).existsSync()) return;
    _peaks = WaveformPainter.load(path);
    _peaksLoaded = true;
  }

  void _loadBeatGrid() {
    if (widget.song.beatGrid == null) return;
    _beatGrid = widget.song.beatGrid!.buffer.asFloat32List();
    _bpm = widget.song.bpm ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    final player = ref.watch(playerProvider);
    final positionAsync = ref.watch(playerPositionProvider);
    final durationAsync = ref.watch(playerDurationProvider);
    final playingAsync = ref.watch(playerPlayingProvider);
    final sync = ref.watch(beatSyncProvider);

    final position = positionAsync.valueOrNull ?? Duration.zero;
    final duration = durationAsync.valueOrNull ?? Duration.zero;
    final isPlaying = playingAsync.valueOrNull ?? false;

    final posSec = position.inSeconds;
    final durSec = duration.inSeconds;
    final posFraction = duration.inMicroseconds > 0
        ? position.inMicroseconds / duration.inMicroseconds
        : 0.0;

    final minStr = '${(posSec ~/ 60).toString().padLeft(2, '0')}:${(posSec % 60).toString().padLeft(2, '0')}';
    final maxStr = '${(durSec ~/ 60).toString().padLeft(2, '0')}:${(durSec % 60).toString().padLeft(2, '0')}';

    return Scaffold(
      appBar: AppBar(title: Text(widget.song.title)),
      body: Column(
        children: [
          const Spacer(),
          if (_peaksLoaded)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                height: 180,
                child: GestureDetector(
                  onTapDown: (details) {
                    final w = context.size?.width ?? 1;
                    final frac = details.localPosition.dx / w;
                    final seekPos = Duration(
                      microseconds: (duration.inMicroseconds * frac).round(),
                    );
                    player.seek(seekPos);
                  },
                  child: CustomPaint(
                    painter: WaveformPainter(
                      _peaks,
                      positionFraction: posFraction,
                    ),
                    size: Size.infinite,
                  ),
                ),
              ),
            ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Text(minStr, style: Theme.of(context).textTheme.bodySmall),
                Expanded(
                  child: Slider(
                    value: posFraction,
                    onChanged: (v) {
                      final seekPos = Duration(
                        microseconds: (duration.inMicroseconds * v).round(),
                      );
                      player.seek(seekPos);
                    },
                  ),
                ),
                Text(maxStr, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Beat sync indicator
          if (_bpm > 0)
            Center(
              child: Text('${_bpm.toStringAsFixed(1)} BPM • ${_beatGrid?.length ?? 0} beats',
                  style: Theme.of(context).textTheme.bodySmall),
            ),
          const SizedBox(height: 8),
          // Transport controls
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.skip_previous, size: 36),
                onPressed: () {
                  sync.onSeek(Duration.zero);
                  player.seek(Duration.zero);
                },
              ),
              const SizedBox(width: 16),
              IconButton(
                icon: Icon(
                  isPlaying ? Icons.pause_circle : Icons.play_circle,
                  size: 56,
                ),
                onPressed: () {
                  if (isPlaying) {
                    sync.stop();
                    player.pause();
                  } else {
                    if (_beatGrid != null && _bpm > 0) {
                      sync.loadBeatGrid(_beatGrid!, _bpm);
                      sync.start();
                    }
                    player.play();
                  }
                },
              ),
              const SizedBox(width: 16),
              IconButton(
                icon: const Icon(Icons.stop, size: 36),
                onPressed: () {
                  sync.stop();
                  player.stop();
                },
              ),
            ],
          ),
          const Spacer(),
        ],
      ),
    );
  }
}
