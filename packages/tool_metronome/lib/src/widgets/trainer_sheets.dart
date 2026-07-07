import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_design/core_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../metronome_state.dart';
import '../trainer.dart';

const double _sheetMaxWidth = 480;
const double _bpmStep = 5;

Future<void> showRampSheet(BuildContext context) =>
    _showTrainerSheet(context, const _RampSheet());

Future<void> showBarMuteSheet(BuildContext context) =>
    _showTrainerSheet(context, const _BarMuteSheet());

Future<void> _showTrainerSheet(BuildContext context, Widget sheet) =>
    showModalBottomSheet(
      context: context,
      constraints: const BoxConstraints(maxWidth: _sheetMaxWidth),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: sheet,
        ),
      ),
    );

class _RampSheet extends ConsumerStatefulWidget {
  const _RampSheet();

  @override
  ConsumerState<_RampSheet> createState() => _RampSheetState();
}

class _RampSheetState extends ConsumerState<_RampSheet> {
  late double _startBpm;
  late double _endBpm;
  late int _bars;

  @override
  void initState() {
    super.initState();
    final settings = ref.read(metronomeProvider);
    _startBpm = settings.ramp.startBpm;
    _endBpm = settings.ramp.endBpm;
    _bars = settings.ramp.bars;
  }

  double _clampBpm(double bpm) =>
      bpm.clamp(MetronomeController.minBpm, MetronomeController.maxBpm);

  @override
  Widget build(BuildContext context) {
    final enabled = ref.watch(metronomeProvider).rampEnabled;
    final notifier = ref.read(metronomeProvider.notifier);
    final ramp = TempoRamp(startBpm: _startBpm, endBpm: _endBpm, bars: _bars);
    return _TrainerSheetBody(
      title: 'Tempo ramp',
      subtitle:
          'Steps the tempo once per bar — '
          '${ramp.stepPerBar >= 0 ? '+' : ''}'
          '${ramp.stepPerBar.toStringAsFixed(1)} BPM per bar.',
      rows: [
        KitbagStepperRow(
          label: 'Start BPM',
          value: '${_startBpm.round()}',
          onStep: (delta) => setState(
            () => _startBpm = _clampBpm(_startBpm + delta * _bpmStep),
          ),
        ),
        KitbagStepperRow(
          label: 'End BPM',
          value: '${_endBpm.round()}',
          onStep: (delta) =>
              setState(() => _endBpm = _clampBpm(_endBpm + delta * _bpmStep)),
        ),
        KitbagStepperRow(
          label: 'Bars',
          value: '$_bars',
          onStep: (delta) => setState(
            () => _bars = (_bars + delta).clamp(
              1,
              MetronomeController.maxRampBars,
            ),
          ),
        ),
      ],
      enabled: enabled,
      applyLabel: enabled ? 'UPDATE RAMP' : 'START RAMP',
      onApply: () => notifier.enableRamp(ramp),
      onDisable: notifier.disableRamp,
    );
  }
}

class _BarMuteSheet extends ConsumerStatefulWidget {
  const _BarMuteSheet();

  @override
  ConsumerState<_BarMuteSheet> createState() => _BarMuteSheetState();
}

class _BarMuteSheetState extends ConsumerState<_BarMuteSheet> {
  late int _playBars;
  late int _muteBars;

  @override
  void initState() {
    super.initState();
    final settings = ref.read(metronomeProvider);
    _playBars = settings.barMute.playBars;
    _muteBars = settings.barMute.muteBars;
  }

  int _clampBars(int bars) => bars.clamp(1, MetronomeController.maxMuteBars);

  @override
  Widget build(BuildContext context) {
    final enabled = ref.watch(metronomeProvider).barMuteEnabled;
    final notifier = ref.read(metronomeProvider.notifier);
    return _TrainerSheetBody(
      title: 'Mute bars',
      subtitle:
          'Play $_playBars ${_playBars == 1 ? 'bar' : 'bars'}, '
          'then $_muteBars silent — keep the time yourself.',
      rows: [
        KitbagStepperRow(
          label: 'Play bars',
          value: '$_playBars',
          onStep: (delta) =>
              setState(() => _playBars = _clampBars(_playBars + delta)),
        ),
        KitbagStepperRow(
          label: 'Mute bars',
          value: '$_muteBars',
          onStep: (delta) =>
              setState(() => _muteBars = _clampBars(_muteBars + delta)),
        ),
      ],
      enabled: enabled,
      applyLabel: enabled ? 'UPDATE' : 'START MUTING',
      onApply: () => notifier.enableBarMute(
        BarMute(playBars: _playBars, muteBars: _muteBars),
      ),
      onDisable: notifier.disableBarMute,
    );
  }
}

/// Shared sheet layout: title, live subtitle, stepper rows, apply/turn-off.
class _TrainerSheetBody extends StatelessWidget {
  const _TrainerSheetBody({
    required this.title,
    required this.subtitle,
    required this.rows,
    required this.enabled,
    required this.applyLabel,
    required this.onApply,
    required this.onDisable,
  });

  final String title;
  final String subtitle;
  final List<Widget> rows;
  final bool enabled;
  final String applyLabel;
  final VoidCallback onApply;
  final VoidCallback onDisable;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: theme.textTheme.headlineMedium),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 12),
        ...rows,
        const SizedBox(height: 16),
        Row(
          children: [
            if (enabled) ...[
              Expanded(
                child: KitbagTileButton(
                  label: 'TURN OFF',
                  onPressed: () {
                    onDisable();
                    Navigator.pop(context);
                  },
                ),
              ),
              const SizedBox(width: 8),
            ],
            Expanded(
              flex: 2,
              child: KitbagTileButton(
                label: applyLabel,
                emphasized: true,
                onPressed: () {
                  onApply();
                  Navigator.pop(context);
                },
              ),
            ),
          ],
        ),
      ],
    );
  }
}
