import 'package:core_design/core_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../metronome_routes.dart';
import '../setlist_state.dart';

/// App-bar setlist control. Idle it is a plain badge into the setlist
/// editor; with a session active it becomes the on-stage pager
/// ("Wedding set · 3/12") — swipe the chip or use the chevrons, its
/// visible twin.
class SetlistChip extends ConsumerWidget {
  const SetlistChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = ref.watch(activeSetlistProvider);
    if (active == null) {
      return Padding(
        padding: const EdgeInsets.only(right: 12),
        child: KitbagChip(
          icon: Icons.queue_music,
          label: 'Setlists',
          onTap: () => context.go(MetronomeRoutes.setlists),
          tooltip: 'Setlists',
        ),
      );
    }
    final notifier = ref.read(activeSetlistProvider.notifier);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          onPressed: active.hasPrevious ? notifier.previous : null,
          icon: const Icon(Icons.chevron_left),
          tooltip: 'Previous song',
        ),
        GestureDetector(
          onHorizontalDragEnd: (details) {
            final velocity = details.primaryVelocity ?? 0;
            if (velocity < 0) {
              notifier.next();
            } else if (velocity > 0) {
              notifier.previous();
            }
          },
          // Capped so long setlist names ellipsize instead of overflowing
          // the app bar on narrow phones.
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 180),
            child: KitbagChip(
              icon: Icons.queue_music,
              label: active.label,
              active: true,
              onTap: () => context.go(MetronomeRoutes.setlists),
              tooltip: 'Open setlists',
            ),
          ),
        ),
        IconButton(
          onPressed: active.hasNext ? notifier.next : null,
          icon: const Icon(Icons.chevron_right),
          tooltip: 'Next song',
        ),
        const SizedBox(width: 8),
      ],
    );
  }
}
