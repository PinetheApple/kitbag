// eslint-plugin-kitbag — the real architecture-rule enforcement (SPEC §13.6):
// JSI/TurboModule imports only in core-native, Zustand create() only in
// core-state, the §13.1 import graph, the §13.3 60fps rule, and a ported eval
// harness that scores rules against pass/fail scenarios.
//
// SKELETON (#27): NONE of that exists yet. The root eslint.config.mjs runs a
// generic-rule stopgap in its place until this plugin lands (a later Phase 2
// wave). This empty plugin only anchors the package. Do NOT wire it into the
// flat config until it has real rules and a passing eval harness.

const plugin = { rules: {} };

export default plugin;
