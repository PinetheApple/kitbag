// The lint config the eval harness scores against — the intended §13.6
// enforcement, assembled from data its owners already export (SPEC §13.7):
//
//   - the four custom rules from `eslint-plugin-kitbag` (spread verbatim from
//     its `recommended` config; each self-scopes by package path), and
//   - the §13.1 import graph, wired into `eslint-plugin-boundaries` from the
//     `boundariesElements` / `boundariesElementTypes` graph data the same
//     plugin owns.
//
// This is precisely the config the root `eslint.config.mjs` becomes once the
// boundaries wire-up (README of eslint-plugin-kitbag) lands. Proving it here
// de-risks that step: a rule change can be VERIFIED, not hoped at.

import type { Linter } from 'eslint';
import boundaries from 'eslint-plugin-boundaries';
import kitbag, {
  boundariesElements,
  boundariesElementTypes,
} from 'eslint-plugin-kitbag';
import tseslint from 'typescript-eslint';

// The scenario fixtures are TypeScript; boundaries resolves their relative
// imports to on-disk target files (and thus to an architectural element) via
// the node resolver, which must be told about the TS/TSX extensions.
const RESOLVER_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

export const evalConfig: Linter.Config[] = [
  // Parse every fixture as TypeScript (with JSX for the `.tsx` components).
  // Syntactic only — the rules need no type information, so no tsconfig project.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser as Linter.Parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // The custom rules — the real §9.4/§13.6 boundary enforcement.
  ...(kitbag.configs.recommended as Linter.Config[]),

  // The import graph — SPEC §13.6 names eslint-plugin-boundaries as the tool.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': boundariesElements,
      'import/resolver': { node: { extensions: RESOLVER_EXTENSIONS } },
    },
    rules: {
      'boundaries/element-types': ['error', boundariesElementTypes],
    },
  },
];
