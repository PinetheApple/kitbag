// The type list below mirrors cliff.toml's commit_parsers exactly:
// feat/fix/perf/revert map to changelog sections; test/docs/chore/refactor/
// style/ci/build parse cleanly and are deliberately skipped from the
// user-facing changelog. Anything else falls into cliff.toml's `.*`
// catch-all and would vanish from the changelog silently — which is why it
// is rejected here rather than allowed. If you add a type here, give it an
// explicit entry in cliff.toml (and vice versa).
const types = [
  'feat',
  'fix',
  'perf',
  'revert',
  'test',
  'docs',
  'chore',
  'refactor',
  'style',
  'ci',
  'build',
];

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', types],
  },
};
