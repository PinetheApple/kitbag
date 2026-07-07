import 'package:core_audio_ffi/core_audio_ffi.dart';
import 'package:core_plugin_api/core_plugin_api.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'instruments.dart';

enum TunerMode { chromatic, instrument }

class TunerSettings {
  const TunerSettings({
    this.mode = TunerMode.instrument,
    this.preset = InstrumentPreset.guitar,
    this.lockedString,
    this.a4 = TunerController.defaultA4,
    this.tunedStrings = const {},
  });

  final TunerMode mode;
  final InstrumentPreset preset;

  /// Index into [preset]'s strings when the player locked a peg; null = auto
  /// string detection.
  final int? lockedString;
  final double a4;

  /// Strings that reached in-tune this session (green peg rings).
  final Set<int> tunedStrings;

  /// Pitch-detection band pushed to the native tuner. The narrow per-string
  /// band is the octave-error kill (PLAN §3).
  ({double lowHz, double highHz}) get detectionBand {
    if (mode == TunerMode.chromatic) {
      return (
        lowHz: TunerController.chromaticLowHz,
        highHz: TunerController.chromaticHighHz,
      );
    }
    final locked = lockedString;
    return locked == null
        ? presetBand(preset, a4)
        : stringBand(preset.strings[locked], a4);
  }

  static const Object _unset = Object();

  TunerSettings copyWith({
    TunerMode? mode,
    InstrumentPreset? preset,
    Object? lockedString = _unset,
    double? a4,
    Set<int>? tunedStrings,
  }) {
    return TunerSettings(
      mode: mode ?? this.mode,
      preset: preset ?? this.preset,
      lockedString: identical(lockedString, _unset)
          ? this.lockedString
          : lockedString as int?,
      a4: a4 ?? this.a4,
      tunedStrings: tunedStrings ?? this.tunedStrings,
    );
  }
}

final tunerProvider = NotifierProvider<TunerNotifier, TunerSettings>(
  TunerNotifier.new,
);

class TunerNotifier extends Notifier<TunerSettings> {
  TunerController get _controller => ref.read(tunerControllerProvider);

  @override
  TunerSettings build() {
    const settings = TunerSettings();
    _push(settings);
    return settings;
  }

  void _push(TunerSettings settings) {
    _controller.setA4(settings.a4);
    final band = settings.detectionBand;
    _controller.setBand(band.lowHz, band.highHz);
  }

  void _update(TunerSettings settings) {
    _push(settings);
    state = settings;
  }

  // No clamp here: TunerController.setA4 is the single clamp point, and
  // the slider already constrains input to the valid range.
  void setA4(double a4) => _update(state.copyWith(a4: a4));

  void toggleChromatic() => _update(
    state.copyWith(
      mode: state.mode == TunerMode.chromatic
          ? TunerMode.instrument
          : TunerMode.chromatic,
      lockedString: null,
    ),
  );

  void setPreset(InstrumentPreset preset) => _update(
    state.copyWith(
      mode: TunerMode.instrument,
      preset: preset,
      lockedString: null,
      tunedStrings: const {},
    ),
  );

  /// Tapping the locked peg again returns to auto detection.
  void toggleStringLock(int index) => _update(
    state.copyWith(lockedString: state.lockedString == index ? null : index),
  );

  void clearStringLock() => _update(state.copyWith(lockedString: null));

  void markStringTuned(int index) {
    if (!state.tunedStrings.contains(index)) {
      state = state.copyWith(tunedStrings: {...state.tunedStrings, index});
    }
  }
}
