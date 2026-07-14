import 'package:flutter/services.dart';

/// Track information from an active media session on the device.
class ActiveTrack {
  final String title;
  final String artist;
  final String album;
  final double duration;
  final bool isPlaying;
  final double position;
  final String packageName;

  const ActiveTrack({
    required this.title,
    required this.artist,
    this.album = '',
    this.duration = 0,
    this.isPlaying = false,
    this.position = 0,
    this.packageName = '',
  });

  factory ActiveTrack.fromMap(Map<String, dynamic> map) => ActiveTrack(
        title: map['title'] as String? ?? '',
        artist: map['artist'] as String? ?? '',
        album: map['album'] as String? ?? '',
        duration: (map['duration'] as num?)?.toDouble() ?? 0,
        isPlaying: map['isPlaying'] as bool? ?? false,
        position: (map['position'] as num?)?.toDouble() ?? 0,
        packageName: map['packageName'] as String? ?? '',
      );
}

/// Bridge to the Android MediaSession channel.
class MediaSessionService {
  static const _channel = MethodChannel('kitbag/media_session');

  /// Returns all currently active media sessions.
  static Future<List<ActiveTrack>> getActiveSessions() async {
    try {
      final result = await _channel.invokeMethod('getActiveSessions');
      if (result is! List) return [];
      return result
          .cast<Map<String, dynamic>>()
          .map(ActiveTrack.fromMap)
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Whether the notification listener permission has been granted
  /// (we can't check this from Dart on Android — user must enable it
  /// in system settings under Notification Access).
  static Future<bool> requestPermission() async {
    try {
      return await _channel.invokeMethod('requestPermission') as bool;
    } catch (_) {
      return false;
    }
  }
}
