import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tool_metronome/tool_metronome.dart';

/// Android system notification for the running metronome, with transport
/// action buttons (play/pause, stop) and ongoing behaviour.
///
/// Initialised at app startup ([init]), then driven by a Riverpod listener
/// via [syncWithState]. Actions call back into the metronome notifier through
/// a stored [ProviderContainer] reference.
class MetronomeNotificationService {
  MetronomeNotificationService._();

  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static ProviderContainer? _container;

  static const int _notificationId = 1001;
  static const String _channelId = 'kitbag_metronome';
  static const String _channelName = 'Metronome';
  static const String _actionPlayPause = 'play_pause';
  static const String _actionStop = 'stop';

  /// Must be called once at app startup (before [ProviderScope]).
  static Future<void> init(ProviderContainer container) async {
    _container = container;

    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const settings = InitializationSettings(android: androidSettings);

    await _plugin.initialize(
      settings,
      onDidReceiveNotificationResponse: _onNotificationResponse,
    );

    // Android 13+ (API 33+) requires explicit notification permission.
    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await android?.requestNotificationsPermission();

    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(
          AndroidNotificationChannel(
            _channelId,
            _channelName,
            description: 'Metronome playback controls',
            importance: Importance.low,
            playSound: false,
            enableVibration: false,
          ),
        );
  }

  static void _onNotificationResponse(NotificationResponse response) {
    switch (response.actionId) {
      case _actionPlayPause:
        _container?.read(metronomeProvider.notifier).toggleRunning();
      case _actionStop:
        _container?.read(metronomeProvider.notifier).stop();
    }
  }

  /// Call this whenever the metronome running state changes.
  static Future<void> syncWithState({
    required bool running,
    required int bpm,
  }) async {
    if (running) {
      await _show(bpm);
    } else {
      await _dismiss();
    }
  }

  static Future<void> _show(int bpm) async {
    final playPauseAction = AndroidNotificationAction(
      _actionPlayPause,
      'Pause',
      showsUserInterface: true,
      cancelNotification: true,
    );
    final stopAction = AndroidNotificationAction(
      _actionStop,
      'Stop',
      showsUserInterface: true,
      cancelNotification: true,
    );

    await _plugin.show(
      _notificationId,
      'Kitbag',
      '$bpm BPM · Metronome',
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          importance: Importance.low,
          priority: Priority.low,
          ongoing: true,
          autoCancel: false,
          showWhen: false,
          playSound: false,
          enableVibration: false,
          category: AndroidNotificationCategory.transport,
          actions: [playPauseAction, stopAction],
          fullScreenIntent: true,
        ),
      ),
    );
  }

  static Future<void> _dismiss() async {
    await _plugin.cancel(_notificationId);
  }
}
