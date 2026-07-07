import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'live_tuning.dart';
import 'mic_permission.dart';
import 'preset_menu.dart';
import 'tuner_state.dart';

/// The tuner. Pegs across the top (tap to lock a string), giant note
/// readout, graduated strip with center line, A4/mode chips below — three
/// redundant feedback channels so color is never load-bearing.
class TunerScreen extends ConsumerStatefulWidget {
  const TunerScreen({super.key});

  @override
  ConsumerState<TunerScreen> createState() => _TunerScreenState();
}

enum _MicStatus { starting, ready, denied, deniedForever, failed }

class _TunerScreenState extends ConsumerState<TunerScreen>
    with WidgetsBindingObserver {
  static const double _maxContentWidth = 480;

  _MicStatus _mic = _MicStatus.starting;
  // Mic stopped because the app left the foreground (finding: raw capture
  // must not keep running in the background).
  bool _suspended = false;
  // Held directly: ref must not be used in dispose.
  late final TunerController _controller;

  @override
  void initState() {
    super.initState();
    _controller = ref.read(tunerControllerProvider);
    WidgetsBinding.instance.addObserver(this);
    // Re-entering the tuner is a fresh session: stale in-tune marks from a
    // previous visit must not survive. Microtask: providers can't be
    // mutated while the first frame is still building.
    Future<void>.microtask(() {
      if (mounted) {
        ref.read(tunerProvider.notifier).resetSession();
      }
    });
    _startMic();
  }

  Future<void> _startMic() async {
    final permission = await ref.read(micPermissionRequestProvider)();
    if (!mounted) {
      return;
    }
    if (permission != MicPermission.granted) {
      setState(() {
        _mic = permission == MicPermission.permanentlyDenied
            ? _MicStatus.deniedForever
            : _MicStatus.denied;
      });
      return;
    }
    try {
      _controller.start();
      setState(() => _mic = _MicStatus.ready);
    } on Exception {
      setState(() => _mic = _MicStatus.failed);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        if (_mic == _MicStatus.ready && !_suspended) {
          _controller.stop();
          _suspended = true;
        }
      case AppLifecycleState.resumed:
        if (_suspended) {
          _suspended = false;
          _startMic();
        } else if (_mic == _MicStatus.denied ||
            _mic == _MicStatus.deniedForever ||
            _mic == _MicStatus.failed) {
          // The user may have granted access in system settings meanwhile.
          _startMic();
        }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (_mic == _MicStatus.ready && !_suspended) {
      _controller.stop();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(tunerProvider);
    final notifier = ref.read(tunerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tuner'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 20),
            child: PresetMenu(settings: settings, notifier: notifier),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _maxContentWidth),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _buildBody(settings, notifier),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(TunerSettings settings, TunerNotifier notifier) {
    switch (_mic) {
      case _MicStatus.starting:
        return const Center(child: CircularProgressIndicator());
      case _MicStatus.denied:
      case _MicStatus.failed:
        return _MicUnavailable(
          message: _mic == _MicStatus.denied
              ? 'Kitbag needs the microphone to hear your instrument.'
              : 'The microphone could not be opened. Is another app using it?',
          onRetry: _startMic,
        );
      case _MicStatus.deniedForever:
        return _MicUnavailable(
          message:
              'Microphone access is turned off for Kitbag. '
              'Enable it in system settings to tune.',
          onRetry: _startMic,
          onOpenSettings: ref.read(openSystemSettingsProvider),
        );
      case _MicStatus.ready:
        // Spec §04 order: pegs, flexible space, giant note directly above
        // the strip (6px), chips 6px below it.
        return Column(
          children: [
            const SizedBox(height: 8),
            Expanded(
              child: LiveTuning(settings: settings, notifier: notifier),
            ),
            const SizedBox(height: 6),
            _ModeChips(settings: settings, notifier: notifier),
            const SizedBox(height: 12),
          ],
        );
    }
  }
}

class _ModeChips extends StatelessWidget {
  const _ModeChips({required this.settings, required this.notifier});

  final TunerSettings settings;
  final TunerNotifier notifier;

  @override
  Widget build(BuildContext context) {
    final chromatic = settings.mode == TunerMode.chromatic;
    // Spec §04: text-only chips, spread across ONE row; only engaged
    // non-default states light up (A4 reference, chromatic mode).
    // Flexible: at 200% text scale the chips ellipsize instead of
    // overflowing or wrapping into a stack.
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
          child: KitbagChip(
            label: 'Auto',
            // Lit when auto-detection is the live mode: instrument mode with
            // no per-string lock engaged (not chromatic, no locked string).
            active: !chromatic && settings.lockedString == null,
            onTap: chromatic ? null : notifier.clearStringLock,
            tooltip: 'Detect the nearest string automatically',
          ),
        ),
        Flexible(
          child: KitbagChip(
            label: 'A4 · ${settings.a4.round()} Hz',
            active: true,
            onTap: () => _showA4Sheet(context),
            tooltip: 'Reference pitch',
          ),
        ),
        Flexible(
          child: KitbagChip(
            label: 'Chromatic',
            active: chromatic,
            onTap: notifier.toggleChromatic,
            tooltip: 'Nearest-note mode, no string pegs',
          ),
        ),
      ],
    );
  }

  void _showA4Sheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      builder: (context) => Consumer(
        builder: (context, ref, _) {
          final a4 = ref.watch(tunerProvider).a4;
          final theme = Theme.of(context);
          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('A4 REFERENCE', style: theme.textTheme.labelSmall),
                const SizedBox(height: 6),
                Text('${a4.round()} Hz', style: theme.textTheme.displayMedium),
                Slider(
                  value: a4,
                  min: TunerController.minA4,
                  max: TunerController.maxA4,
                  divisions: (TunerController.maxA4 - TunerController.minA4)
                      .round(),
                  onChanged: notifier.setA4,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// No dead ends: if the mic can't be used, say why and offer a way out —
/// retry always, plus system settings when the grant is permanently denied.
class _MicUnavailable extends StatelessWidget {
  const _MicUnavailable({
    required this.message,
    required this.onRetry,
    this.onOpenSettings,
  });

  final String message;
  final VoidCallback onRetry;
  final Future<void> Function()? onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.mic_off, size: 40, color: theme.colorScheme.primary),
          const SizedBox(height: 12),
          Text('Microphone unavailable', style: theme.textTheme.headlineMedium),
          const SizedBox(height: 4),
          Text(
            message,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          if (onOpenSettings != null) ...[
            KitbagTileButton(
              label: 'Open settings',
              emphasized: true,
              onPressed: () {
                onOpenSettings!();
              },
            ),
            const SizedBox(height: 8),
          ],
          KitbagTileButton(label: 'Try again', onPressed: onRetry),
        ],
      ),
    );
  }
}
