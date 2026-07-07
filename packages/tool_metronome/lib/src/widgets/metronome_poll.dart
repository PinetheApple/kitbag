import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Polls one value from the native metronome atomics on a vsync [Ticker]
/// while [active], rebuilding only when the value changes — realtime state
/// never streams through the provider graph. While inactive the ticker is
/// stopped and [idle] is shown.
class MetronomePoll<T> extends ConsumerStatefulWidget {
  const MetronomePoll({
    super.key,
    required this.active,
    required this.idle,
    required this.read,
    required this.builder,
  });

  final bool active;
  final T idle;
  final T Function(MetronomeController metronome) read;
  final Widget Function(BuildContext context, T value) builder;

  @override
  ConsumerState<MetronomePoll<T>> createState() => _MetronomePollState<T>();
}

class _MetronomePollState<T> extends ConsumerState<MetronomePoll<T>>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  late T _value = widget.idle;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick);
    _syncTicker();
  }

  @override
  void didUpdateWidget(MetronomePoll<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncTicker();
  }

  void _syncTicker() {
    if (widget.active) {
      _value = widget.read(ref.read(metronomeControllerProvider));
      if (!_ticker.isActive) {
        _ticker.start();
      }
    } else {
      _ticker.stop();
      _value = widget.idle;
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  void _onTick(Duration elapsed) {
    final value = widget.read(ref.read(metronomeControllerProvider));
    if (value != _value) {
      setState(() => _value = value);
    }
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _value);
}
