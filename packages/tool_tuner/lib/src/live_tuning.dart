import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'instruments.dart';
import 'tuner_state.dart';
import 'widgets/headstock.dart';

/// The slow half of the live region: the headstock only depends on the
/// detected NOTE (not the 60fps cents stream), so it rebuilds on note
/// changes while [_PitchDial] alone re-renders every frame.
class LiveTuning extends StatefulWidget {
  const LiveTuning({super.key, required this.settings, required this.notifier});

  final TunerSettings settings;
  final TunerNotifier notifier;

  @override
  State<LiveTuning> createState() => _LiveTuningState();
}

class _LiveTuningState extends State<LiveTuning> {
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
    // Spec: flexible space above, note sits directly on the strip (6px).
    return Column(
      children: [
        const Spacer(),
        AnimatedOpacity(
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
        const SizedBox(height: 6),
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
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          noteIndex >= 0 ? noteNameForMidi(noteIndex) : '—',
          // The 64px giant-note role from the spec's .notebig.
          style: theme.textTheme.displaySmall,
        ),
        const SizedBox(height: 4),
        Text(
          _hint,
          // Spec .notebig small: the labelMedium role (13px, tight tracking)
          // pairs with the displaySmall giant note above.
          style: theme.textTheme.labelMedium?.copyWith(
            color: inTune ? inTuneColor : null,
          ),
        ),
      ],
    );
  }
}
