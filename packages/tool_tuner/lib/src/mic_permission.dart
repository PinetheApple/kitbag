import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart' as ph;

/// Outcome of asking for mic access.
enum MicPermission { granted, denied, permanentlyDenied }

/// Requests mic access where the platform gates it. Provider indirection so
/// widget tests can override the OS dialog away.
final micPermissionRequestProvider = Provider<Future<MicPermission> Function()>(
  (ref) => _requestMicPermission,
);

/// Opens the system settings page for this app — the only way out of a
/// permanently-denied grant. Overridable in tests.
final openSystemSettingsProvider = Provider<Future<void> Function()>(
  (ref) => () async {
    await ph.openAppSettings();
  },
);

Future<MicPermission> _requestMicPermission() async {
  // Desktop has no runtime permission dialog (PipeWire handles access).
  if (!Platform.isAndroid && !Platform.isIOS) {
    return MicPermission.granted;
  }
  final status = await ph.Permission.microphone.request();
  if (status.isGranted || status.isLimited) {
    return MicPermission.granted;
  }
  return status.isPermanentlyDenied
      ? MicPermission.permanentlyDenied
      : MicPermission.denied;
}
