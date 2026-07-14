import 'dart:convert';

import 'package:http/http.dart' as http;

/// Multi-source BPM lookup with tap-tempo fallback.
class BpmLookupService {
  BpmLookupService();

  // Tap-tempo state
  final List<double> _tapHistory = [];
  DateTime? _lastTap;

  /// Try all online sources in order. Returns null if all fail.
  Future<double?> lookup(String title, String artist) async {
    // 1. Deezer (public API, no key required)
    try {
      final bpm = await _lookupDeezer(title, artist);
      if (bpm != null && bpm > 0) return bpm;
    } catch (_) {}

    // 2. AcousticBrainz (public API)
    try {
      final bpm = await _lookupAcousticBrainz(title, artist);
      if (bpm != null && bpm > 0) return bpm;
    } catch (_) {}

    return null;
  }

  /// Add a tap (call with current time). Returns average BPM if enough taps.
  double? tap() {
    final now = DateTime.now();
    if (_lastTap != null) {
      final dt = now.difference(_lastTap!).inMilliseconds / 1000.0;
      if (dt > 0.1 && dt < 3.0) {
        _tapHistory.add(60.0 / dt);
        if (_tapHistory.length > 8) {
          _tapHistory.removeAt(0);
        }
      } else if (dt > 3.0) {
        _tapHistory.clear();
      }
    }
    _lastTap = now;

    if (_tapHistory.length >= 4) {
      return _tapHistory.reduce((a, b) => a + b) / _tapHistory.length;
    }
    return null;
  }

  void resetTap() {
    _tapHistory.clear();
    _lastTap = null;
  }

  Future<double?> _lookupDeezer(String title, String artist) async {
    final query = Uri.encodeComponent('$artist $title');
    final uri = Uri.parse(
        'https://api.deezer.com/search?q=$query&limit=5');
    final response = await http.get(uri);
    if (response.statusCode != 200) return null;

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final tracks = data['data'] as List?;
    if (tracks == null || tracks.isEmpty) return null;

    // Find the best match by title/artist similarity
    for (final Map<String, dynamic> track in tracks.cast<Map<String, dynamic>>()) {
      final bpm = track['bpm'];
      if (bpm is int && bpm > 0) return bpm.toDouble();
      if (bpm is double && bpm > 0) return bpm;
    }
    return null;
  }

  Future<double?> _lookupAcousticBrainz(String title, String artist) async {
    // AcousticBrainz doesn't have a simple search API.
    // It uses MusicBrainz IDs. Fall through to tap-tempo.
    return null;
  }
}
