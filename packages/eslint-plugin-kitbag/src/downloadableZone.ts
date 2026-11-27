import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

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

export const WITHHELD_REACT_NATIVE: readonly string[] = [
  'NativeModules',
  'TurboModuleRegistry',
  'DeviceEventEmitter',
  'Linking',
];

export const DOWNLOADABLE_MESSAGE =
  'A downloadable tool imports only the allowlist and reaches the rest of ' +
  'the app through ToolHost (SPEC §13.1, §9.1).';

const MANIFEST = 'package.json';

interface Manifest {
  readonly kitbag?: { readonly downloadable?: boolean };
}

export interface DownloadableRestrictions {
  readonly paths: { name: string; importNames: string[]; message: string }[];
  readonly patterns: { regex: string; message: string }[];
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
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

export function downloadableRestrictions(): DownloadableRestrictions {
  const allowed = DOWNLOADABLE_IMPORTS.map(escapeRegex).join('|');
  return {
    paths: [
      {
        name: 'react-native',
        importNames: [...WITHHELD_REACT_NATIVE],
        message: DOWNLOADABLE_MESSAGE,
      },
    ],
    patterns: [
      {
        regex: `^(?![./])(?!(?:${allowed})$)`,
        message: DOWNLOADABLE_MESSAGE,
      },
    ],
  };
}
