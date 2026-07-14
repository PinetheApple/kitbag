import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Tunable parameters for the tuner's real-time pitch polling.
///
/// Override [tunerPollingConfigProvider] in tests to control timing and
/// sensitivity without touching the concrete widget.
class TunerPollingConfig {
  const TunerPollingConfig({
    this.minConfidence = 0.85,
    this.holdDuration = const Duration(milliseconds: 1750),
    this.inTuneCents = 3,
  });

  /// Minimum [AudioReading.confidence] to accept a pitch as valid.
  final double minConfidence;

  /// How long the last confident reading is held on screen after the signal
  /// drops below [minConfidence]. Matches GuitarTuna's fast-attack,
  /// slow-release feel.
  final Duration holdDuration;

  /// Cents window (±) within which the pitch is considered perfectly in tune.
  final double inTuneCents;
}

final tunerPollingConfigProvider = Provider<TunerPollingConfig>(
  (ref) => const TunerPollingConfig(),
);
