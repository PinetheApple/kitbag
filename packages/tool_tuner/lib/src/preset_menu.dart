import 'package:core_db/core_db.dart';
import 'package:core_design/core_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'custom_tunings.dart';
import 'instruments.dart';
import 'tuner_state.dart';
import 'tuning_editor_sheet.dart';

/// Instrument/tuning picker behind the app-bar chip: built-in presets,
/// saved custom tunings (tap to apply, pencil to edit), and the entry point
/// for saving the current tuning as a new custom one.
class PresetMenu extends ConsumerWidget {
  const PresetMenu({super.key, required this.settings, required this.notifier});

  final TunerSettings settings;
  final TunerNotifier notifier;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savedTunings = ref.watch(savedTuningsProvider);
    final tunings = savedTunings.valueOrNull ?? const <Tuning>[];
    // Loading collapses to an empty list (the menu simply shows built-ins),
    // but a database error must not masquerade as "no saved tunings".
    final loadError = savedTunings.hasError && !savedTunings.isLoading;
    if (loadError) {
      debugPrint('savedTuningsProvider failed: ${savedTunings.error}');
    }
    return PopupMenuButton<VoidCallback>(
      tooltip: 'Choose instrument or tuning',
      onSelected: (action) => action(),
      itemBuilder: (menuContext) => [
        for (final preset in InstrumentPreset.all)
          PopupMenuItem(
            value: () => notifier.setPreset(preset),
            child: Text(preset.label),
          ),
        if (loadError) ...[
          const PopupMenuDivider(),
          PopupMenuItem(
            enabled: false,
            child: Text(
              "Couldn't load saved tunings",
              style: TextStyle(color: Theme.of(menuContext).colorScheme.error),
            ),
          ),
        ],
        if (tunings.isNotEmpty) const PopupMenuDivider(),
        for (final tuning in tunings)
          PopupMenuItem(
            value: () => notifier.setPreset(presetFromTuning(tuning)),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${tuning.name} · Custom',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  tooltip: 'Edit tuning',
                  icon: const Icon(Icons.edit, size: 18),
                  // Explicit 48dp constraints + standard density so the tap
                  // target holds under the desktop adaptivePlatformDensity
                  // (COMPACT), which would otherwise shrink it to ~40dp.
                  constraints: const BoxConstraints(
                    minWidth: 48,
                    minHeight: 48,
                  ),
                  style: IconButton.styleFrom(
                    visualDensity: VisualDensity.standard,
                  ),
                  onPressed: () {
                    Navigator.of(menuContext).pop();
                    showTuningEditor(
                      context,
                      seed: settings.preset,
                      existing: tuning,
                    );
                  },
                ),
              ],
            ),
          ),
        const PopupMenuDivider(),
        PopupMenuItem(
          value: () {
            // Editor opens seeded with the current preset's strings.
            showTuningEditor(context, seed: settings.preset);
          },
          child: const Row(
            children: [
              Icon(Icons.add, size: 18),
              SizedBox(width: 8),
              Flexible(
                child: Text(
                  'Save as custom tuning…',
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ],
      child: KitbagChip(
        label: settings.mode == TunerMode.chromatic
            ? 'Chromatic'
            : settings.preset.label,
        active: true,
      ),
    );
  }
}
