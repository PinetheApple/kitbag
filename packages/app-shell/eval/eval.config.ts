import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Linter } from 'eslint';
import boundaries from 'eslint-plugin-boundaries';
import kitbag, {
  boundariesElements,
  boundariesElementTypes,
  downloadablePackages,
  downloadableZoneConfig,
} from 'eslint-plugin-kitbag';
import tseslint from 'typescript-eslint';

// The scenario fixtures are TypeScript; boundaries resolves their relative
// imports to on-disk target files (and thus to an architectural element) via
// the node resolver, which must be told about the TS/TSX extensions.
const RESOLVER_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

const SCENARIOS_DIR = fileURLToPath(new URL('./scenarios', import.meta.url));
const PACKAGES = 'packages';

const childDirs = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const scenarioPackageDirs: string[] = childDirs(SCENARIOS_DIR).flatMap(
  (group) =>
    childDirs(path.join(SCENARIOS_DIR, group)).map((scenario) =>
      path.posix.join(group, scenario, PACKAGES),
    ),
);

const downloadableFiles: string[] = scenarioPackageDirs.flatMap((dir) =>
  downloadablePackages(path.join(SCENARIOS_DIR, dir)).map((name) =>
    path.posix.join(dir, name, '**'),
  ),
);

export const evalConfig: Linter.Config[] = [
  // Parse every fixture as TypeScript (with JSX for the `.tsx` components).
  // Syntactic only — the rules need no type information, so no tsconfig project.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  ...kitbag.configs.recommended,

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

  ...downloadableZoneConfig(downloadableFiles),
];
