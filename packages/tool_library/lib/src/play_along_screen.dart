import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:core_db/core_db.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'beat_sync_service.dart';
import 'player_state.dart';
import 'waveform_painter.dart';

class PlayAlongScreen extends ConsumerStatefulWidget {
  const PlayAlongScreen({super.key, required this.song});

  final LibrarySong song;

  @override
  ConsumerState<PlayAlongScreen> createState() => _PlayAlongScreenState();
}

class _PlayAlongScreenState extends ConsumerState<PlayAlongScreen>
    with SingleTickerProviderStateMixin {
  List<List<PeakPair>> _peaks = [];
  bool _peaksLoaded = false;
  Float32List? _beatGrid;
  double _bpm = 0;
  late Ticker _ticker;
  int _activeBeat = -1;

  @override
  void initState() {
    super.initState();
    _loadWaveform();
    _loadBeatGrid();
    _initPlayer();
    _ticker = createTicker(_onTick)..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
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

  void _onTick(Duration _) {
    if (!mounted) return;
    final metronome = ref.read(metronomeControllerProvider);
    final beat = metronome.currentBeat;
    if (beat != _activeBeat) {
      setState(() => _activeBeat = beat);
    }
  }

  @override
  Widget build(BuildContext context) {
    final player = ref.watch(playerProvider);
    final positionAsync = ref.watch(playerPositionProvider);
    final durationAsync = ref.watch(playerDurationProvider);
    final playingAsync = ref.watch(playerPlayingProvider);
    final sync = ref.watch(beatSyncProvider);
    final metronome = ref.watch(metronomeControllerProvider);

    final position = positionAsync.valueOrNull ?? Duration.zero;
    final duration = durationAsync.valueOrNull ?? Duration.zero;
    final isPlaying = playingAsync.valueOrNull ?? false;

    final posFraction = duration.inMicroseconds > 0
        ? position.inMicroseconds / duration.inMicroseconds
        : 0.0;

    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.song.title),
        actions: [
          if (_bpm > 0)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Text('${_bpm.toStringAsFixed(1)} BPM',
                    style: Theme.of(context).textTheme.bodyMedium),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          // Waveform with seek
          if (_peaksLoaded)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: SizedBox(
                height: 120,
                child: GestureDetector(
                  onTapDown: (details) {
                    final w = context.size?.width ?? 1;
                    final frac = details.localPosition.dx / w;
                    final seekPos = Duration(
                      microseconds: (duration.inMicroseconds * frac).round(),
                    );
                    sync.onSeek(seekPos);
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

          // Beat LED indicator
          if (_bpm > 0)
            _BeatCircle(
              beatCount: _beatGrid?.length ?? 4,
              activeBeat: _activeBeat,
              color: scheme.primary,
              size: 20,
            ),

          const SizedBox(height: 12),

          // Bar sweep
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 48),
            child: SizedBox(
              height: 4,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(2),
                ),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: FractionallySizedBox(
                    widthFactor: _activeBeat >= 0
                        ? (_activeBeat + 1) / (_beatGrid?.length ?? 1.0)
                        : 0,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: scheme.primary,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 8),

          // Time slider
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Text(_fmt(position.inSeconds),
                    style: Theme.of(context).textTheme.bodySmall),
                Expanded(
                  child: Slider(
                    value: posFraction,
                    onChanged: (v) {
                      final seekPos = Duration(
                        microseconds: (duration.inMicroseconds * v).round(),
                      );
                      sync.onSeek(seekPos);
                      player.seek(seekPos);
                    },
                  ),
                ),
                Text(_fmt(duration.inSeconds),
                    style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Transport controls
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.skip_previous, size: 32),
                onPressed: () {
                  sync.onSeek(Duration.zero);
                  player.seek(Duration.zero);
                },
              ),
              const SizedBox(width: 24),
              _TransportButton(
                isPlaying: isPlaying,
                onPressed: () {
                  if (isPlaying) {
                    sync.stop();
                    player.pause();
                  } else {
                    if (_beatGrid != null && _bpm > 0) {
                      sync.loadBeatGrid(_beatGrid!, _bpm);
                      sync.start();
                      metronome.setTempo(_bpm);
                    }
                    player.play();
                  }
                },
              ),
              const SizedBox(width: 24),
              IconButton(
                icon: const Icon(Icons.stop, size: 32),
                onPressed: () {
                  sync.stop();
                  player.stop();
                },
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Metronome controls
          if (_bpm > 0)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Row(
                children: [
                  const Icon(Icons.speed, size: 18),
                  const SizedBox(width: 8),
                  Text(_bpm.toStringAsFixed(0),
                      style: Theme.of(context).textTheme.titleLarge),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline),
                    onPressed: () {
                      if (_bpm > 30) {
                        _bpm -= 1;
                        metronome.setTempo(_bpm);
                        sync.loadBeatGrid(_beatGrid!, _bpm);
                      }
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline),
                    onPressed: () {
                      if (_bpm < 300) {
                        _bpm += 1;
                        metronome.setTempo(_bpm);
                        sync.loadBeatGrid(_beatGrid!, _bpm);
                      }
                    },
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  String _fmt(int sec) {
    final m = (sec ~/ 60).toString().padLeft(2, '0');
    final s = (sec % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }
}

class _BeatCircle extends StatelessWidget {
  const _BeatCircle({
    required this.beatCount,
    required this.activeBeat,
    required this.color,
    this.size = 16,
  });

  final int beatCount;
  final int activeBeat;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final gap = size * 0.3;
    final radius = beatCount > 1
        ? (size + gap) / (2 * math.sin(math.pi / beatCount))
        : 0.0;
    return SizedBox(
      height: (radius + size / 2) * 2,
      child: Stack(
        alignment: Alignment.center,
        children: List.generate(beatCount, (i) {
          final angle = i * 2 * math.pi / beatCount - math.pi / 2;
          final x = radius * math.cos(angle);
          final y = radius * math.sin(angle);
          final isActive = i == activeBeat;
          return Positioned(
            left: x + radius + size / 2 - size / 2,
            top: y + radius + size / 2 - size / 2,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 80),
              width: isActive ? size * 1.3 : size,
              height: isActive ? size * 1.3 : size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isActive ? color : Colors.transparent,
                border: Border.all(
                  color: isActive ? color : Colors.grey,
                  width: isActive ? 2 : 1,
                ),
                boxShadow: isActive
                    ? [BoxShadow(color: color.withAlpha(140), blurRadius: 10)]
                    : null,
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _TransportButton extends StatelessWidget {
  const _TransportButton({
    required this.isPlaying,
    required this.onPressed,
  });

  final bool isPlaying;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 64,
      height: 64,
      child: Material(
        shape: const CircleBorder(),
        color: Theme.of(context).colorScheme.primary,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: Icon(
            isPlaying ? Icons.pause : Icons.play_arrow,
            color: Theme.of(context).colorScheme.onPrimary,
            size: 36,
          ),
        ),
      ),
    );
  }
}
