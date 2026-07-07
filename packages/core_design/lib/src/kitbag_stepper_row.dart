import 'package:flutter/material.dart';

import 'components.dart';

/// Label + −/value/+ stepper row for config sheets.
class KitbagStepperRow extends StatelessWidget {
  const KitbagStepperRow({
    super.key,
    required this.label,
    required this.value,
    required this.onStep,
  });

  final String label;
  final String value;

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
    return Row(
      children: [
        Expanded(child: Text(label, style: theme.textTheme.bodyMedium)),
        step(Icons.remove, -1, 'Decrease $label'),
        SizedBox(
          width: 72,
          child: Center(child: KitbagBadge(label: value)),
        ),
        step(Icons.add, 1, 'Increase $label'),
      ],
    );
  }
}
