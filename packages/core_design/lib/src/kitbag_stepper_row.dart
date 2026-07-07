import 'package:flutter/material.dart';

import 'components.dart';

/// A −/value/+ stepper. Two shapes share one set of ≥48dp [IconButton] tap
/// targets (spec §06):
///
///  * the default full-width row — `label ……… − value +` — for config
///    sheets, and
///  * [KitbagStepperRow.inline] — a shrink-wrapped `− child +` cluster that
///    wraps an arbitrary badge, used inside dense cards.
class KitbagStepperRow extends StatelessWidget {
  const KitbagStepperRow({
    super.key,
    required String this.label,
    required String this.value,
    required this.onStep,
  }) : child = null,
       semanticLabel = 'value';

  /// Compact `− child +` cluster around an existing badge/label widget.
  /// [semanticLabel] names the value for the stepper button tooltips.
  const KitbagStepperRow.inline({
    super.key,
    required Widget this.child,
    required this.onStep,
    this.semanticLabel = 'value',
  }) : label = null,
       value = null;

  final String? label;
  final String? value;
  final Widget? child;
  final String semanticLabel;

  /// Called with −1 or +1 per tap.
  final ValueChanged<int> onStep;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Widget step(IconData icon, int delta, String tooltip) => IconButton(
      onPressed: () => onStep(delta),
      tooltip: tooltip,
      icon: Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
    );

    if (child != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          step(Icons.remove, -1, 'Decrease $semanticLabel'),
          child!,
          step(Icons.add, 1, 'Increase $semanticLabel'),
        ],
      );
    }

    return Row(
      children: [
        Expanded(child: Text(label!, style: theme.textTheme.bodyMedium)),
        step(Icons.remove, -1, 'Decrease $label'),
        SizedBox(
          width: 72,
          child: Center(child: KitbagBadge(label: value!)),
        ),
        step(Icons.add, 1, 'Increase $label'),
      ],
    );
  }
}
