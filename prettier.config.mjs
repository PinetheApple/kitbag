// Staged ahead of the RN app (SPEC §13/§13.6); wired when Phase 2 scaffolds.
// Cannot run until package.json exists. See config/README.md.

/**
 * printWidth is 80 to match the C++ realtime core, which is the source of
 * truth (`native/audio_core/.clang-format`: ColumnLimit 80, IndentWidth 2).
 * core-native engineers read `.ts` bindings and `.cpp`/`.h` side by side
 * (SPEC §13.2, §13.7); one column limit across the boundary keeps diffs and
 * split-pane review aligned. JSX can crowd 80, but consistency with the layer
 * the TS mirrors wins over a roomier default.
 *
 * @type {import("prettier").Config}
 */
export default {
  printWidth: 80,
  tabWidth: 2, // matches clang-format IndentWidth 2
  singleQuote: true, // reference setup convention (verse_learning_app)
  semi: true,
  trailingComma: 'all',
  arrowParens: 'always',
};
