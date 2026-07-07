import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'instruments.dart';
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

class _TunerScreenState extends ConsumerState<TunerScreen> {
  static const double _maxContentWidth = 480;

  bool _micFailed = false;
  // Held directly: ref must not be used in dispose.
  late final TunerController _controller;

  @override
  void initState() {
    super.initState();
    _controller = ref.read(tunerControllerProvider);
    _startMic();
  }

  void _startMic() {
    try {
      _controller.start();
      _micFailed = false;
    } on Exception {
      _micFailed = true;
    }
  }

  @override
  void dispose() {
    if (!_micFailed) {
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
              child: _micFailed
                  ? _MicUnavailable(onRetry: () => setState(_startMic))
                  : Column(
                      children: [
                        const SizedBox(height: 8),
                        Expanded(
                          child: _LiveTuning(
                            settings: settings,
                            notifier: notifier,
                          ),
                        ),
                        const SizedBox(height: 14),
                        _ModeChips(settings: settings, notifier: notifier),
                        const SizedBox(height: 12),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Everything that moves with the mic: pegs, giant note, strip. One vsync
/// ticker polls the native atomics directly — no provider churn at 60fps.
class _LiveTuning extends ConsumerStatefulWidget {
  const _LiveTuning({required this.settings, required this.notifier});

  final TunerSettings settings;
  final TunerNotifier notifier;

  @override
  ConsumerState<_LiveTuning> createState() => _LiveTuningState();
}

class _LiveTuningState extends ConsumerState<_LiveTuning>
    with SingleTickerProviderStateMixin {
  static const double _inTuneCents = 3;
  static const double _minConfidence = .85;

  late final Ticker _ticker;
  int _noteIndex = -1;
  double _cents = 0;
  bool _inTune = false;

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
    final tuner = ref.read(tunerControllerProvider);
    final noteIndex = tuner.noteIndex;
    final hasPitch = noteIndex >= 0 && tuner.confidence >= _minConfidence;
    // Displayed at 0.1 cent resolution; avoids setState on sub-visible noise.
    final cents = hasPitch ? (tuner.cents * 10).roundToDouble() / 10 : 0.0;
    final inTune = hasPitch && cents.abs() <= _inTuneCents;

    if (inTune && !_inTune) {
      // The in-tune lock moment: one confirmation tick, peg goes green.
      HapticFeedback.lightImpact();
      final string = _stringForNote(noteIndex);
      if (string != null) {
        widget.notifier.markStringTuned(string);
      }
    }
    final newNoteIndex = hasPitch ? noteIndex : -1;
    if (newNoteIndex != _noteIndex || cents != _cents || inTune != _inTune) {
      setState(() {
        _noteIndex = newNoteIndex;
        _cents = cents;
        _inTune = inTune;
      });
    }
  }

  /// The string being tuned: the locked one, else the nearest to the played
  /// note (auto detection) — but only when its target note matches.
  int? _stringForNote(int noteIndex) {
    final settings = widget.settings;
    if (settings.mode == TunerMode.chromatic) {
      return null;
    }
    final index =
        settings.lockedString ?? nearestStringIndex(settings.preset, noteIndex);
    return settings.preset.strings[index].midiNote == noteIndex ? index : null;
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
    final hasPitch = _noteIndex >= 0;
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
          child: _NoteReadout(
            noteIndex: _noteIndex,
            cents: _cents,
            inTune: _inTune,
          ),
        ),
        KitbagTunerStrip(cents: hasPitch ? _cents : null),
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
    final inTuneColor = theme.brightness == Brightness.dark
        ? KitbagColors.darkInTune
        : KitbagColors.lightInTune;
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
        label: settings.mode == TunerMode.chromatic
            ? 'Chromatic'
            : settings.preset.label,
        on: true,
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
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        KitbagChip(
          label: 'Auto',
          on: !chromatic && settings.lockedString == null,
          onTap: chromatic ? null : notifier.clearStringLock,
        ),
        KitbagChip(
          label: 'A4 · ${settings.a4.round()} Hz',
          on: true,
          onTap: () => _showA4Sheet(context),
        ),
        KitbagChip(
          label: 'Chromatic',
          on: chromatic,
          onTap: notifier.toggleChromatic,
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

/// No dead ends: if the mic can't open, say so and offer a retry.
class _MicUnavailable extends StatelessWidget {
  const _MicUnavailable({required this.onRetry});

  final VoidCallback onRetry;

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
            'Check the microphone permission, then try again.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          KitbagTileButton(label: 'Try again', onPressed: onRetry),
        ],
      ),
    );
  }
}
