// The full §13.1 import graph, expressed for `eslint-plugin-boundaries`.
//
// SPEC §13.6 names eslint-plugin-boundaries as the tool for the whole import
// graph — "cheaper than hand-rolling it". This module owns the graph as DATA:
// element definitions (which folder is which architectural layer) and the
// allow-list per layer. The custom rules in this plugin enforce the three edges
// that a generic graph check states weakly (JSI/TurboModule holder, Zustand
// store holder, contract-imports-nothing); boundaries covers the rest.
//
// WIRING: consuming this needs `plugins: { boundaries }` in the flat config,
// which lives in the ROOT eslint.config.mjs (a shared file). That final wire-up
// is a deliberate, separate step — see this package's README. This module ships
// the settings + rule options so that step is a spread, not a re-derivation
// (SPEC §13.7: the graph has one owner).

interface BoundaryElement {
  type: string;
  pattern: string;
  mode?: 'folder' | 'file' | 'full';
}

interface BoundaryRule {
  from: string[];
  allow: string[];
}

interface ElementTypesOptions {
  default: 'allow' | 'disallow';
  rules: BoundaryRule[];
}

// One element per package layer (SPEC §13.1). `tool` captures every tool-*.
export const boundariesElements: BoundaryElement[] = [
  { type: 'app-shell', pattern: 'packages/app-shell' },
  { type: 'core-plugin-api', pattern: 'packages/core-plugin-api' },
  { type: 'core-native', pattern: 'packages/core-native' },
  { type: 'core-state', pattern: 'packages/core-state' },
  { type: 'core-db', pattern: 'packages/core-db' },
  { type: 'core-design', pattern: 'packages/core-design' },
  { type: 'tool', pattern: 'packages/tool-*' },
];

// The "May import" column of SPEC §13.1, verbatim.
export const boundariesElementTypes: ElementTypesOptions = {
  default: 'disallow',
  rules: [
    // app-shell may import everything.
    {
      from: ['app-shell'],
      allow: [
        'core-plugin-api',
        'core-native',
        'core-state',
        'core-db',
        'core-design',
        'tool',
      ],
    },
    // core-plugin-api imports nothing.
    { from: ['core-plugin-api'], allow: [] },
    // core-native may import core-plugin-api.
    { from: ['core-native'], allow: ['core-plugin-api'] },
    // core-state may import core-native, core-db, core-plugin-api.
    {
      from: ['core-state'],
      allow: ['core-native', 'core-db', 'core-plugin-api'],
    },
    // core-db may import core-plugin-api.
    { from: ['core-db'], allow: ['core-plugin-api'] },
    // core-design may import core-plugin-api.
    { from: ['core-design'], allow: ['core-plugin-api'] },
    // tool-* may import core-*, never another tool, never app-shell.
    {
      from: ['tool'],
      allow: [
        'core-plugin-api',
        'core-native',
        'core-state',
        'core-db',
        'core-design',
      ],
    },
  ],
};
