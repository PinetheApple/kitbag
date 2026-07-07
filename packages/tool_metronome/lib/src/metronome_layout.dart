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
/// The density is only a *preference*: a height budget estimates the fixed
/// controls stack at each density and picks the roomiest that fits. It does
/// NOT guarantee fit — [MetronomeLayout] wraps the editing content in a
/// scroll-when-needed viewport with the transport pinned below, so an
/// underestimate degrades to "scrolls a little", never a RenderFlex
/// overflow. That keeps correctness independent of the (necessarily
/// approximate) height model. Degradation ladder (spec §06):
///
/// 1. whitespace compresses ([MetronomeDensity.compact]),
/// 2. chrome shrinks — smaller transport, tighter card — and the readout
///    gives up its chevrons so the BPM digits stay glanceable
///    ([MetronomeDensity.dense]),
/// 3. wide-but-short windows (landscape phone, split-screen) regroup into
///    two panes: readout + transport beside the editing stack,
/// 4. last resort: the editing stack scrolls and the transport stays pinned,
///    always reachable mid-practice.
class MetronomeLayoutSpec {
  const MetronomeLayoutSpec._({required this.density, required this.twoPane});

  factory MetronomeLayoutSpec.resolve({
    required BoxConstraints constraints,
    required double textScale,
    required bool polyRow,
  }) {
    final ts = textScale.clamp(1.0, 2.0);
    final h = constraints.maxHeight;
    final w = constraints.maxWidth;

    final twoPane = w >= _twoPaneMinWidth && h < _twoPaneMaxHeight && w > h;

    // Width the chip row / card actually get, so the estimate accounts for
    // chip wrapping. In two-pane the editing side owns a flex-weighted slice.
    final double innerWidth;
    if (twoPane) {
      final usable =
          w.clamp(0.0, _twoPaneContentWidth) - _horizontalPadding * 2 - paneGap;
      innerWidth = usable * editPaneFlex / (editPaneFlex + playPaneFlex);
    } else {
      innerWidth = w.clamp(0.0, _contentWidth) - _horizontalPadding * 2;
    }

    // In two-pane the readout sits in its own pane, so only the editing
    // stack competes for the height; otherwise readout + transport share it.
    var chosen = MetronomeDensity.dense;
    for (final density in MetronomeDensity.values) {
      final needed = twoPane
          ? _stackHeight(density, ts, polyRow, innerWidth)
          : _stackHeight(density, ts, polyRow, innerWidth) +
                _gap(density) +
                _playSize(density) +
                8 +
                _readoutMin(density);
      if (needed <= (twoPane ? h - 8 : h)) {
        chosen = density;
        break;
      }
    }
    return MetronomeLayoutSpec._(density: chosen, twoPane: twoPane);
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

  final MetronomeDensity density;

  /// Landscape/split-screen regrouping: readout + transport on the left,
  /// the editing stack (presets, pattern, chips) on the right.
  final bool twoPane;

  bool get compactControls => density != MetronomeDensity.roomy;
  bool get showChevrons => density != MetronomeDensity.dense;

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

  /// Rough height estimate for the editing stack (presets + card + chips)
  /// plus its two internal gaps. Advisory only — it steers density choice,
  /// while the scroll-and-pin net guarantees no overflow if it is wrong.
  static double _stackHeight(
    MetronomeDensity d,
    double ts,
    bool poly,
    double innerWidth,
  ) {
    final roomy = d == MetronomeDensity.roomy;
    final presets = (20 * ts + (roomy ? 28 : 16)).clamp(40.0, 96.0);
    // Chips wrap to two rows on narrow panes; assume the worst below 380dp.
    final chipRows = innerWidth < 380 ? 2 : 1;
    final chipHeight = (16 * ts + 30).clamp(48.0, 96.0);
    final chips = chipRows * chipHeight + (chipRows - 1) * 4;
    final pad = d.cardPadding;
    final rowGap = d.cardRowGap;
    // The stepper rows use ≥48dp tap targets, so the badge row can't be
    // shorter than that; the LED row can also wrap at high beat counts.
    final badgeRow = (16 * ts + 32).clamp(48.0, 120.0);
    final segmented = (16 * ts + 24).clamp(48.0, 96.0);
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
///
/// The editing content lives in a scroll-when-needed viewport so the
/// transport is always pinned and reachable; [onScrollableChanged] reports
/// whether that viewport is *actually* scrolling, letting the screen yield
/// swipe/scroll-wheel tempo control to scrolling only when there is
/// something to scroll.
class MetronomeLayout extends StatefulWidget {
  const MetronomeLayout({
    super.key,
    required this.spec,
    required this.readout,
    required this.presets,
    required this.pattern,
    required this.chips,
    required this.transport,
    required this.onScrollableChanged,
  });

  final MetronomeLayoutSpec spec;
  final Widget readout;
  final Widget presets;
  final Widget pattern;
  final Widget chips;
  final Widget transport;
  final ValueChanged<bool> onScrollableChanged;

  @override
  State<MetronomeLayout> createState() => _MetronomeLayoutState();
}

class _MetronomeLayoutState extends State<MetronomeLayout> {
  final ScrollController _controller = ScrollController();
  bool _lastScrollable = false;

  /// Swipe only yields to scrolling once there is a *meaningful* amount to
  /// scroll. A rounding-level overflow (a control a few dp too tall for the
  /// window) is not worth surrendering the swipe-anywhere tempo gesture — the
  /// pinned transport already guarantees nothing important is clipped, and
  /// the scroll view still absorbs the couple of pixels either way.
  static const double _swipeScrollGrace = 16;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// After layout, tell the screen whether the editing viewport is scrolling
  /// enough to own vertical drags.
  void _reportScrollable() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final scrollable =
          _controller.hasClients &&
          _controller.position.hasContentDimensions &&
          _controller.position.maxScrollExtent > _swipeScrollGrace;
      if (scrollable != _lastScrollable) {
        _lastScrollable = scrollable;
        widget.onScrollableChanged(scrollable);
      }
    });
  }

  List<Widget> get _editingStack => [
    widget.presets,
    SizedBox(height: widget.spec.sectionGap),
    widget.pattern,
    SizedBox(height: widget.spec.sectionGap),
    widget.chips,
  ];

  @override
  Widget build(BuildContext context) {
    _reportScrollable();
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: widget.spec.maxContentWidth),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: MetronomeLayoutSpec._horizontalPadding,
          ),
          child: widget.spec.twoPane ? _twoPane() : _column(),
        ),
      ),
    );
  }

  /// A viewport that centers [content] when it fits and scrolls it (via
  /// [_controller], so scrollability is observable) only when it is taller
  /// than the space available. The readout's own [FittedBox] already scales
  /// down, so an Expanded here would add nothing but the intrinsic-height
  /// fragility of a scroll view — hence plain centering.
  Widget _scrollWhenNeeded(Widget content) {
    return LayoutBuilder(
      builder: (context, viewport) => SingleChildScrollView(
        controller: _controller,
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: viewport.maxHeight),
          child: content,
        ),
      ),
    );
  }

  /// Portrait: readout above the editing stack, the whole group centered and
  /// scrolling only when it outgrows the space above the pinned transport.
  Widget _column() {
    return Column(
      children: [
        Expanded(
          child: _scrollWhenNeeded(
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                widget.readout,
                SizedBox(height: widget.spec.sectionGap),
                ..._editingStack,
              ],
            ),
          ),
        ),
        SizedBox(height: widget.spec.sectionGap),
        widget.transport,
        const SizedBox(height: 8),
      ],
    );
  }

  /// Landscape/split-screen: the play side (readout + transport) keeps the
  /// left pane whole-height; the editing stack sits beside it, centered when
  /// it fits and scrolling only when the pane is shorter than the stack.
  Widget _twoPane() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          flex: MetronomeLayoutSpec.playPaneFlex,
          child: Column(
            children: [
              Expanded(child: widget.readout),
              SizedBox(height: widget.spec.sectionGap),
              widget.transport,
              const SizedBox(height: 8),
            ],
          ),
        ),
        const SizedBox(width: MetronomeLayoutSpec.paneGap),
        Expanded(
          flex: MetronomeLayoutSpec.editPaneFlex,
          child: _scrollWhenNeeded(
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: _editingStack,
            ),
          ),
        ),
      ],
    );
  }
}
