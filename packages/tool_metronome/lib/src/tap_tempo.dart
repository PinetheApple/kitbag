/// Tap-tempo estimator: averages the intervals of a burst of taps.
/// A pause longer than [resetGap] starts a new burst.
class TapTempo {
  TapTempo({this.resetGap = const Duration(seconds: 2), this.window = 4});

  final Duration resetGap;
  final int window;

  final List<DateTime> _taps = [];

  /// Registers a tap; returns the estimated BPM once two taps exist.
  double? tap([DateTime? at]) {
    final now = at ?? DateTime.now();
    if (_taps.isNotEmpty && now.difference(_taps.last) > resetGap) {
      _taps.clear();
    }
    _taps.add(now);
    if (_taps.length < 2) {
      return null;
    }
    while (_taps.length > window + 1) {
      _taps.removeAt(0);
    }
    final totalMicroseconds = _taps.last.difference(_taps.first).inMicroseconds;
    final intervals = _taps.length - 1;
    final microsecondsPerBeat = totalMicroseconds / intervals;
    return Duration.microsecondsPerSecond * 60 / microsecondsPerBeat;
  }

  void reset() => _taps.clear();
}
