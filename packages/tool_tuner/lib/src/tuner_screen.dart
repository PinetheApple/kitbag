import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'instruments.dart';
import 'mic_permission.dart';
import 'tuner_state.dart';
import 'widgets/headstock.dart';

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
            child: _PresetMenu(settings: settings, notifier: notifier),
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
        return Column(
          children: [
            const SizedBox(height: 8),
            Expanded(
              child: _LiveTuning(settings: settings, notifier: notifier),
            ),
            const SizedBox(height: 14),
            _ModeChips(settings: settings, notifier: notifier),
            const SizedBox(height: 12),
          ],
        );
    }
  }
}

/// The slow half of the live region: the headstock only depends on the
/// detected NOTE (not the 60fps cents stream), so it rebuilds on note
/// changes while [_PitchDial] alone re-renders every frame.
class _LiveTuning extends StatefulWidget {
  const _LiveTuning({required this.settings, required this.notifier});

  final TunerSettings settings;
  final TunerNotifier notifier;

  @override
  State<_LiveTuning> createState() => _LiveTuningState();
}

class _LiveTuningState extends State<_LiveTuning> {
  int _noteIndex = -1;

  void _onNoteChanged(int noteIndex) {
    if (noteIndex != _noteIndex) {
      setState(() => _noteIndex = noteIndex);
    }
  }

  /// The in-tune lock moment: one confirmation tick, peg goes green.
  /// Haptics only make sense against a target string — instrument mode.
  void _onInTune(int noteIndex) {
    final settings = widget.settings;
    if (settings.mode != TunerMode.instrument) {
      return;
    }
    HapticFeedback.lightImpact();
    final index =
        settings.lockedString ?? nearestStringIndex(settings.preset, noteIndex);
    if (settings.preset.strings[index].midiNote == noteIndex) {
      widget.notifier.markStringTuned(index);
    }
  }

  int? get _activeString {
    final settings = widget.settings;
    if (settings.mode == TunerMode.chromatic) {
      return null;
    }
    if (settings.lockedString != null) {
      return settings.lockedString;
    }
    return _noteIndex >= 0
        ? nearestStringIndex(settings.preset, _noteIndex)
        : null;
  }

  @override
  Widget build(BuildContext context) {
    final settings = widget.settings;
    return Column(
      children: [
        if (settings.mode == TunerMode.instrument)
          Headstock(
            preset: settings.preset,
            activeString: _activeString,
            tunedStrings: settings.tunedStrings,
            onPegTap: widget.notifier.toggleStringLock,
          ),
        Expanded(
          child: _PitchDial(onNoteChanged: _onNoteChanged, onInTune: _onInTune),
        ),
      ],
    );
  }
}

/// The fast half: giant note + cents hint + strip. One vsync ticker polls
/// the packed native snapshot (a single FFI call) — no provider churn at
/// 60fps — and reports note changes / in-tune moments upward.
class _PitchDial extends ConsumerStatefulWidget {
  const _PitchDial({required this.onNoteChanged, required this.onInTune});

  /// Fired when the detected nearest note changes; -1 = silence.
  final ValueChanged<int> onNoteChanged;

  /// Fired once per continuous in-tune episode, with the note that locked.
  final ValueChanged<int> onInTune;

  @override
  ConsumerState<_PitchDial> createState() => _PitchDialState();
}

class _PitchDialState extends ConsumerState<_PitchDial>
    with SingleTickerProviderStateMixin {
  static const double _inTuneCents = 3;
  static const double _minConfidence = .85;

  /// Fast attack, slow release: a fresh note shows instantly, but when the
  /// string stops ringing the last reading lingers (frozen needle, gently
  /// dimmed) before relaxing to idle — the GuitarTuna feel.
  static const Duration _holdDuration = Duration(milliseconds: 1750);

  late final Ticker _ticker;
  int _noteIndex = -1;
  double _cents = 0;
  bool _inTune = false;
  bool _holding = false;
  Duration? _lastConfidentAt;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick)..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  void _onTick(Duration elapsed) {
    final reading = ref.read(tunerControllerProvider).read();
    final confident = reading.hasPitch && reading.confidence >= _minConfidence;

    int noteIndex;
    double cents;
    bool inTune;
    bool holding;
    if (confident) {
      _lastConfidentAt = elapsed;
      noteIndex = reading.noteIndex;
      // Displayed at 0.1 cent resolution; avoids setState on noise.
      cents = (reading.cents * 10).roundToDouble() / 10;
      inTune = cents.abs() <= _inTuneCents;
      holding = false;
    } else if (_lastConfidentAt != null &&
        elapsed - _lastConfidentAt! < _holdDuration) {
      // Hold window: freeze the last reading instead of snapping to idle.
      noteIndex = _noteIndex;
      cents = _cents;
      inTune = _inTune;
      holding = true;
    } else {
      noteIndex = -1;
      cents = 0;
      inTune = false;
      holding = false;
    }

    if (confident && inTune && !_inTune) {
      widget.onInTune(noteIndex);
    }
    if (noteIndex != _noteIndex) {
      widget.onNoteChanged(noteIndex);
    }
    if (noteIndex != _noteIndex ||
        cents != _cents ||
        inTune != _inTune ||
        holding != _holding) {
      setState(() {
        _noteIndex = noteIndex;
        _cents = cents;
        _inTune = inTune;
        _holding = holding;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: AnimatedOpacity(
            // Gentle fade while holding; instant full strength on attack.
            opacity: _holding ? .55 : 1,
            duration: _holding
                ? const Duration(milliseconds: 600)
                : const Duration(milliseconds: 80),
            child: _NoteReadout(
              noteIndex: _noteIndex,
              cents: _cents,
              inTune: _inTune,
            ),
          ),
        ),
        KitbagTunerStrip(cents: _noteIndex >= 0 ? _cents : null),
      ],
    );
  }
}

class _NoteReadout extends StatelessWidget {
  const _NoteReadout({
    required this.noteIndex,
    required this.cents,
    required this.inTune,
  });

  final int noteIndex;
  final double cents;
  final bool inTune;

  String get _hint {
    if (noteIndex < 0) {
      return 'PLAY A NOTE';
    }
    if (inTune) {
      return 'IN TUNE';
    }
    final rounded = cents.abs().round();
    return cents < 0
        ? '−$rounded CENTS · TUNE UP ↑'
        : '+$rounded CENTS · TUNE DOWN ↓';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final inTuneColor = context.kitbagInTune;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            noteIndex >= 0 ? noteNameForMidi(noteIndex) : '—',
            style: theme.textTheme.displayMedium,
          ),
          const SizedBox(height: 6),
          Text(
            _hint,
            style: theme.textTheme.labelSmall?.copyWith(
              color: inTune ? inTuneColor : null,
            ),
          ),
        ],
      ),
    );
  }
}

class _PresetMenu extends StatelessWidget {
  const _PresetMenu({required this.settings, required this.notifier});

  final TunerSettings settings;
  final TunerNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<InstrumentPreset>(
      tooltip: 'Choose instrument',
      onSelected: notifier.setPreset,
      itemBuilder: (context) => [
        for (final preset in InstrumentPreset.all)
          PopupMenuItem(value: preset, child: Text(preset.label)),
      ],
      child: KitbagChip(
        icon: Icons.music_note,
        label: settings.mode == TunerMode.chromatic
            ? 'Chromatic'
            : settings.preset.label,
        active: true,
      ),
    );
  }
}

class _ModeChips extends StatelessWidget {
  const _ModeChips({required this.settings, required this.notifier});

  final TunerSettings settings;
  final TunerNotifier notifier;

  @override
  Widget build(BuildContext context) {
    final chromatic = settings.mode == TunerMode.chromatic;
    // Wrap, not Row: survives 200% text scale without overflowing.
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 8,
      children: [
        KitbagChip(
          icon: Icons.autorenew,
          label: 'Auto',
          active: !chromatic && settings.lockedString == null,
          onTap: chromatic ? null : notifier.clearStringLock,
          tooltip: 'Detect the nearest string automatically',
        ),
        KitbagChip(
          icon: Icons.tune,
          label: 'A4 · ${settings.a4.round()} Hz',
          active: true,
          onTap: () => _showA4Sheet(context),
          tooltip: 'Reference pitch',
        ),
        KitbagChip(
          icon: Icons.piano,
          label: 'Chromatic',
          active: chromatic,
          onTap: notifier.toggleChromatic,
          tooltip: 'Nearest-note mode, no string pegs',
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
