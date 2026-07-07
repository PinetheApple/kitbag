import 'package:flutter/material.dart';

/// How tightly the metronome column is packed. Resolved once per build by
/// [MetronomeLayoutSpec.resolve] from the body constraints and text scale.
enum MetronomeDensity { roomy, compact, dense }

/// Density-derived metrics shared by the layout spec and the widgets that
/// compress with it (pattern card paddings).
extension MetronomeDensityMetrics on MetronomeDensity {
  double get cardPadding => switch (this) {
    MetronomeDensity.roomy => 14,
    MetronomeDensity.compact => 12,
    MetronomeDensity.dense => 10,
  };

  double get cardRowGap => switch (this) {
    MetronomeDensity.roomy => 12,
    MetronomeDensity.compact => 10,
    MetronomeDensity.dense => 8,
  };
}

/// Resolved responsive plan for the metronome screen.
///
/// Instead of hard-coded height tiers, the plan is chosen by a budget: the
/// estimated height of the fixed controls stack (presets + pattern card +
/// chips + transport) at each density, plus a minimum readable readout.
/// The roomiest density that fits wins. Degradation ladder (spec §06 — the
/// transport must stay reachable mid-practice, so it scrolls last):
///
/// 1. whitespace compresses ([MetronomeDensity.compact]),
/// 2. chrome shrinks — smaller transport, tighter card — and the readout
///    gives up its chevrons so the BPM digits stay glanceable
///    ([MetronomeDensity.dense]),
/// 3. wide-but-short windows (landscape phone, split-screen) regroup into
///    two panes: readout + transport beside the editing stack,
/// 4. last resort: the editing stack scrolls and the transport pins to the
///    bottom, always visible.
class MetronomeLayoutSpec {
  const MetronomeLayoutSpec._({
    required this.density,
    required this.twoPane,
    required this.paneScrolls,
    required this.pinnedScroll,
  });

  factory MetronomeLayoutSpec.resolve({
    required BoxConstraints constraints,
    required double textScale,
    required bool polyRow,
  }) {
    final ts = textScale.clamp(1.0, 2.0);
    final h = constraints.maxHeight;
    final w = constraints.maxWidth;

    if (w >= _twoPaneMinWidth && h < _twoPaneMaxHeight && w > h) {
      // The editing pane holds the chip row, so estimate its share (not a
      // half): a wider editing pane keeps the chips to one/two rows even at
      // 200% text, while the play pane only needs the readout + transport.
      final usable =
          w.clamp(0.0, _twoPaneContentWidth) - _horizontalPadding * 2 - paneGap;
      final paneWidth = usable * editPaneFlex / (editPaneFlex + playPaneFlex);
      for (final density in MetronomeDensity.values) {
        if (_stackHeight(density, ts, polyRow, paneWidth) <= h - 8) {
          return MetronomeLayoutSpec._(
            density: density,
            twoPane: true,
            paneScrolls: false,
            pinnedScroll: false,
          );
        }
      }
      return const MetronomeLayoutSpec._(
        density: MetronomeDensity.dense,
        twoPane: true,
        paneScrolls: true,
        pinnedScroll: false,
      );
    }

    final innerWidth = w.clamp(0.0, _contentWidth) - _horizontalPadding * 2;
    for (final density in MetronomeDensity.values) {
      final controls =
          _stackHeight(density, ts, polyRow, innerWidth) +
          _gap(density) +
          _playSize(density) +
          8;
      if (controls + _readoutMin(density) <= h) {
        return MetronomeLayoutSpec._(
          density: density,
          twoPane: false,
          paneScrolls: false,
          pinnedScroll: false,
        );
      }
    }
    return const MetronomeLayoutSpec._(
      density: MetronomeDensity.dense,
      twoPane: false,
      paneScrolls: false,
      pinnedScroll: true,
    );
  }

  static const double _contentWidth = 480;
  static const double _twoPaneContentWidth = 880;
  static const double _twoPaneMinWidth = 560;
  static const double _twoPaneMaxHeight = 480;

  /// Symmetric horizontal padding around the content column.
  static const double _horizontalPadding = 20;

  /// Two-pane split. The editing pane (which owns the chip row) is wider
  /// than the play pane so the chips stay to two rows even at 200% text.
  static const int playPaneFlex = 4;
  static const int editPaneFlex = 5;
  static const double paneGap = 24;

  /// Fixed readout height inside the pinned-scroll fallback (the only mode
  /// where the readout cannot flex).
  static const double pinnedReadoutHeight = 120;

  final MetronomeDensity density;

  /// Landscape/split-screen regrouping: readout + transport on the left,
  /// the editing stack (presets, pattern, chips) on the right.
  final bool twoPane;

  /// Two-pane where even the dense editing stack overflows the pane: the
  /// right pane scrolls, so swipe-anywhere yields to scrolling.
  final bool paneScrolls;

  /// Portrait last resort: editing stack scrolls, transport pinned below.
  final bool pinnedScroll;

  bool get compactControls => density != MetronomeDensity.roomy;
  bool get showChevrons => density != MetronomeDensity.dense;
  bool get swipeYieldsToScroll => pinnedScroll || paneScrolls;

  double get sectionGap => _gap(density);
  double get playSize => _playSize(density);
  double get maxContentWidth => twoPane ? _twoPaneContentWidth : _contentWidth;

  double get circleSize => switch (density) {
    MetronomeDensity.roomy => 46,
    MetronomeDensity.compact => 40,
    MetronomeDensity.dense => 38,
  };

  static double _gap(MetronomeDensity d) => switch (d) {
    MetronomeDensity.roomy => 16,
    MetronomeDensity.compact => 10,
    MetronomeDensity.dense => 7,
  };

  static double _playSize(MetronomeDensity d) => switch (d) {
    MetronomeDensity.roomy => 72,
    MetronomeDensity.compact => 58,
    MetronomeDensity.dense => 52,
  };

  /// Smallest readout that still reads from a music stand at each density.
  static double _readoutMin(MetronomeDensity d) => switch (d) {
    MetronomeDensity.roomy => 190,
    MetronomeDensity.compact => 130,
    MetronomeDensity.dense => 88,
  };

  /// Height estimate for the editing stack (presets + card + chips) plus
  /// its two internal gaps. Deliberately leans high: overestimating flips
  /// to a tighter tier early, underestimating would overflow the column.
  static double _stackHeight(
    MetronomeDensity d,
    double ts,
    bool poly,
    double innerWidth,
  ) {
    final roomy = d == MetronomeDensity.roomy;
    final presets = (20 * ts + (roomy ? 28 : 16)).clamp(40.0, 96.0);
    // Chips wrap to two rows on narrow panes; assume the worst below 300dp.
    final chipRows = innerWidth < 300 ? 2 : 1;
    final chipHeight = (16 * ts + 30).clamp(48.0, 96.0);
    final chips = chipRows * chipHeight + (chipRows - 1) * 4;
    final pad = d.cardPadding;
    final rowGap = d.cardRowGap;
    final badgeRow = (16 * ts + 14).clamp(30.0, 96.0);
    final segmented = 16 * ts + 24;
    final card =
        pad * 2 +
        badgeRow +
        (poly ? badgeRow + rowGap : 0) +
        rowGap +
        segmented +
        2;
    return presets + card + chips + _gap(d) * 2;
  }
}

/// Arranges the metronome's five sections according to a
/// [MetronomeLayoutSpec]. Pure layout: all content comes in as slots.
class MetronomeLayout extends StatelessWidget {
  const MetronomeLayout({
    super.key,
    required this.spec,
    required this.readout,
    required this.presets,
    required this.pattern,
    required this.chips,
    required this.transport,
  });

  final MetronomeLayoutSpec spec;
  final Widget readout;
  final Widget presets;
  final Widget pattern;
  final Widget chips;
  final Widget transport;

  List<Widget> get _editingStack => [
    presets,
    SizedBox(height: spec.sectionGap),
    pattern,
    SizedBox(height: spec.sectionGap),
    chips,
  ];

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: spec.maxContentWidth),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: MetronomeLayoutSpec._horizontalPadding,
          ),
          child: spec.twoPane
              ? _twoPane()
              : spec.pinnedScroll
              ? _pinnedScroll()
              : _column(),
        ),
      ),
    );
  }

  Widget _column() {
    return Column(
      children: [
        Expanded(child: readout),
        ..._editingStack,
        SizedBox(height: spec.sectionGap),
        transport,
        const SizedBox(height: 8),
      ],
    );
  }

  /// Editing stack scrolls; the transport stays pinned and reachable.
  Widget _pinnedScroll() {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            child: Column(
              children: [
                SizedBox(
                  height: MetronomeLayoutSpec.pinnedReadoutHeight,
                  child: readout,
                ),
                ..._editingStack,
              ],
            ),
          ),
        ),
        SizedBox(height: spec.sectionGap),
        transport,
        const SizedBox(height: 8),
      ],
    );
  }

  /// Landscape/split-screen: the play side (readout + transport) keeps the
  /// left pane whole-height; the editing stack sits beside it. The scroll
  /// view around the stack shrink-wraps, so it only actually scrolls when
  /// the pane is shorter than the stack.
  Widget _twoPane() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          flex: MetronomeLayoutSpec.playPaneFlex,
          child: Column(
            children: [
              Expanded(child: readout),
              SizedBox(height: spec.sectionGap),
              transport,
              const SizedBox(height: 8),
            ],
          ),
        ),
        const SizedBox(width: MetronomeLayoutSpec.paneGap),
        Expanded(
          flex: MetronomeLayoutSpec.editPaneFlex,
          child: Center(
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: _editingStack,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
