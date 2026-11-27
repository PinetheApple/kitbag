import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { Linter } from 'eslint';

import { kitbagPlugin } from './plugin.ts';

export const DOWNLOADABLE_IMPORTS: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-native',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-gesture-handler',
  'react-native-svg',
  '@kitbag/core-design',
  '@kitbag/core-plugin-api',
];

export const CURATED_REACT_NATIVE: readonly string[] = [
  'View',
  'Text',
  'ScrollView',
  'Image',
  'Pressable',
  'FlatList',
  'SectionList',
  'StyleSheet',
  'useWindowDimensions',
  'Platform',
];

export const DOWNLOADABLE_MESSAGE =
  'A downloadable tool imports only the allowlist and reaches the rest of ' +
  'the app through ToolHost (SPEC §13.1, §9.1).';

const DYNAMIC_IMPORT_MESSAGE =
  'A downloadable tool imports statically, so the build and the runtime ' +
  'shim can check every import (SPEC §13.6).';

const MANIFEST = 'package.json';
const NOT_RELATIVE = '(?![./])';

interface Manifest {
  readonly kitbag?: { readonly downloadable?: boolean };
}

type RestrictedPath = Record<string, unknown>;
type RestrictedPattern = Record<string, unknown>;
type RestrictedSyntax = Readonly<{ selector: string; message: string }>;

export interface ZoneBase {
  readonly paths?: readonly RestrictedPath[];
  readonly patterns?: readonly RestrictedPattern[];
  readonly syntax?: readonly RestrictedSyntax[];
}

const DYNAMIC_IMPORT_SYNTAX: readonly RestrictedSyntax[] = [
  {
    selector: "CallExpression[callee.type='Identifier'][callee.name='require']",
    message: DYNAMIC_IMPORT_MESSAGE,
  },
  { selector: 'ImportExpression', message: DYNAMIC_IMPORT_MESSAGE },
];

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function notExactly(names: readonly string[]): string {
  return `(?!(?:${names.map(escapeRegex).join('|')})$)`;
}

function isDownloadable(packageDir: string): boolean {
  const manifestPath = path.join(packageDir, MANIFEST);
  if (!existsSync(manifestPath)) return false;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  return manifest.kitbag?.downloadable === true;
}

export function downloadablePackages(packagesDir: string): string[] {
  if (!existsSync(packagesDir)) return [];
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => isDownloadable(path.join(packagesDir, name)));
}

function restrictedImports(base: ZoneBase): Linter.RuleEntry {
  const reactNative = {
    name: 'react-native',
    allowImportNames: [...CURATED_REACT_NATIVE],
    message: DOWNLOADABLE_MESSAGE,
  };
  const outsideAllowlist = {
    regex: `^${NOT_RELATIVE}${notExactly(DOWNLOADABLE_IMPORTS)}`,
    message: DOWNLOADABLE_MESSAGE,
  };
  return [
    'error',
    {
      paths: [...(base.paths ?? []), reactNative],
      patterns: [...(base.patterns ?? []), outsideAllowlist],
    },
  ];
}

export function downloadableZoneConfig(
  files: readonly string[],
  base: ZoneBase = {},
): Linter.Config[] {
  if (files.length === 0) return [];
  return [
    {
      files: [...files],
      plugins: { kitbag: kitbagPlugin },
      rules: {
        'no-restricted-imports': restrictedImports(base),
        'no-restricted-syntax': [
          'error',
          ...(base.syntax ?? []),
          ...DYNAMIC_IMPORT_SYNTAX,
        ],
        'kitbag/no-import-outside-package': 'error',
        'kitbag/no-engine-read-to-js-thread': 'error',
      },
    },
  ];
}
