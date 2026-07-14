import 'package:core_db/core_db.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

final playerProvider = Provider<AudioPlayer>((ref) {
  final player = AudioPlayer();
  ref.onDispose(player.dispose);
  return player;
});

final currentSongProvider = StateProvider<LibrarySong?>((ref) => null);

final playerPositionProvider = StreamProvider<Duration?>((ref) {
  final player = ref.watch(playerProvider);
  return player.positionStream;
});

final playerDurationProvider = StreamProvider<Duration?>((ref) {
  final player = ref.watch(playerProvider);
  return player.durationStream;
});

final playerPlayingProvider = StreamProvider<bool>((ref) {
  final player = ref.watch(playerProvider);
  return player.playingStream;
});

final playerLoopModeProvider = StateProvider<LoopMode>((ref) => LoopMode.off);
