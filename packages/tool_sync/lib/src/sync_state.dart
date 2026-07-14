import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'media_session_service.dart';

/// Currently detected active track, or null.
final activeTrackProvider = StateProvider<ActiveTrack?>((ref) => null);

/// BPM detected from the current track (lookup or tap).
final detectedBpmProvider = StateProvider<double>((ref) => 0);

/// Whether the metronome is phase-locked to the active track.
final isPhaseLockedProvider = StateProvider<bool>((ref) => false);

/// Phase offset in ms (positive = metronome plays earlier).
final phaseOffsetMsProvider = StateProvider<double>((ref) => 0);

/// Polls for active media sessions every [intervalMs].
final mediaSessionPollerProvider = StateProvider<bool>((ref) => false);
