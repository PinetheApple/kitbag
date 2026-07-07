import 'dart:typed_data';

import 'package:core_db/core_db.dart';
import 'package:core_design/core_design.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'custom_tunings.dart';
import 'instruments.dart';
import 'tuner_state.dart';

/// Opens the custom-tuning editor. Creating starts from [seed] (the preset
/// on screen); passing [existing] edits a saved tuning. Saving selects the
/// tuning so the pegs immediately show it.
Future<void> showTuningEditor(
  BuildContext context, {
  required InstrumentPreset seed,
  Tuning? existing,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => Padding(
      // Keep the sheet above the soft keyboard while naming.
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: _TuningEditorSheet(seed: seed, existing: existing),
    ),
  );
}

class _TuningEditorSheet extends ConsumerStatefulWidget {
  const _TuningEditorSheet({required this.seed, this.existing});

  final InstrumentPreset seed;
  final Tuning? existing;

  @override
  ConsumerState<_TuningEditorSheet> createState() => _TuningEditorSheetState();
}

class _TuningEditorSheetState extends ConsumerState<_TuningEditorSheet> {
  // C1..C6 — anything a stringed instrument tunes to, with slack.
  static const int _minMidi = 24;
  static const int _maxMidi = 84;

  late final TextEditingController _name = TextEditingController(
    text: widget.existing?.name ?? '',
  );
  late final List<int> _midis = widget.existing != null
      // Clamp on seed: a stored tuning could hold an out-of-range note from an
      // older schema, and the steppers must start inside the editable band.
      ? [
          for (final note in widget.existing!.notes)
            note.clamp(_minMidi, _maxMidi),
        ]
      : [for (final string in widget.seed.strings) string.midiNote];

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      return;
    }
    final dao = ref.read(kitbagDatabaseProvider).tuningsDao;
    final notifier = ref.read(tunerProvider.notifier);
    final bytes = Uint8List.fromList(_midis);
    final int id;
    if (widget.existing == null) {
      id = await dao.create(name, bytes);
    } else {
      id = widget.existing!.id;
      // One atomic write: name and notes never land as two partial updates.
      await dao.updateTuning(id, name, bytes);
    }
    notifier.setPreset(presetFromNotes(id: id, name: name, notes: _midis));
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _delete() async {
    final existing = widget.existing!;
    final confirmed = await confirmDelete(
      context,
      title: 'Delete "${existing.name}"?',
      message: 'This saved tuning is removed from the preset menu.',
    );
    if (!confirmed || !mounted) {
      return;
    }
    // Capture ref-derived handles BEFORE awaiting: after the async gap the
    // sheet may be disposed, and touching ref then throws (mirrors _save).
    final dao = ref.read(kitbagDatabaseProvider).tuningsDao;
    final notifier = ref.read(tunerProvider.notifier);
    final selectedIsThis =
        ref.read(tunerProvider).preset.id == 'custom-${existing.id}';
    await dao.deleteTuning(existing.id);
    if (!mounted) {
      return;
    }
    // Don't leave the pegs on a tuning that no longer exists.
    if (selectedIsThis) {
      notifier.setPreset(InstrumentPreset.guitar);
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.existing == null ? 'NEW CUSTOM TUNING' : 'EDIT TUNING',
              style: theme.textTheme.labelSmall,
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _name,
              autofocus: widget.existing == null,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(hintText: 'Name — e.g. Drop D'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
            for (var i = 0; i < _midis.length; i++)
              KitbagStepperRow(
                label: 'String ${_midis.length - i}',
                value: noteNameForMidi(_midis[i]),
                onStep: (delta) => setState(() {
                  _midis[i] = (_midis[i] + delta).clamp(_minMidi, _maxMidi);
                }),
              ),
            const SizedBox(height: 8),
            // OverflowBar wraps the actions onto stacked lines rather than
            // overflowing when they don't fit (narrow sheets, 200% text
            // scale, and the momentarily-tight width during the sheet's
            // entrance animation).
            OverflowBar(
              alignment: MainAxisAlignment.end,
              spacing: 8,
              overflowSpacing: 8,
              children: [
                if (widget.existing != null)
                  TextButton(onPressed: _delete, child: const Text('Delete')),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: _name.text.trim().isEmpty ? null : _save,
                  child: const Text('Save'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
