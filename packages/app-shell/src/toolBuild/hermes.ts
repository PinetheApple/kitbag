import { execFileSync } from 'node:child_process';
import path from 'node:path';

import type { RuntimePins } from './manifest.ts';
import { appShellRequire, BuildError } from './paths.ts';

const HERMESC_BIN_DIRS: Partial<Record<NodeJS.Platform, string>> = {
  linux: 'linux64-bin',
  darwin: 'osx-bin',
  win32: 'win64-bin',
};
const HBC_MAGIC = Buffer.from('c61fbc03c103191f', 'hex');
const HBC_VERSION_BYTES = 4;
const BYTECODE_VERSION_LINE = /HBC bytecode version: (\d+)/;
const RUNTIME_PACKAGES = {
  reactNative: 'react-native',
  react: 'react',
  reanimated: 'react-native-reanimated',
  worklets: 'react-native-worklets',
} as const;

export function hermescPath(): string {
  const binDir = HERMESC_BIN_DIRS[process.platform];
  if (binDir === undefined)
    throw new BuildError(`no hermesc for ${process.platform}`);
  const compilerPackage = appShellRequire.resolve(
    'hermes-compiler/package.json',
    {
      paths: [
        path.dirname(appShellRequire.resolve('react-native/package.json')),
      ],
    },
  );
  return path.join(path.dirname(compilerPackage), 'hermesc', binDir, 'hermesc');
}

// Relative names, because hermesc embeds the source name and a rebuild must match byte for byte.
export function compileHermes(
  dir: string,
  jsName: string,
  hbcName: string,
): void {
  try {
    execFileSync(
      hermescPath(),
      ['-emit-binary', '-O', '-out', hbcName, jsName],
      {
        cwd: dir,
        stdio: 'pipe',
      },
    );
  } catch (error) {
    throw new BuildError(`hermesc failed: ${String(error)}`);
  }
}

export function hermescBytecodeVersion(): number {
  const output = execFileSync(hermescPath(), ['-version'], {
    encoding: 'utf8',
  });
  const match = BYTECODE_VERSION_LINE.exec(output);
  if (match?.[1] === undefined)
    throw new BuildError('hermesc -version printed no bytecode version');
  return Number(match[1]);
}

export function hbcBytecodeVersion(bytes: Buffer): number | undefined {
  const header = HBC_MAGIC.length + HBC_VERSION_BYTES;
  if (
    bytes.length < header ||
    !bytes.subarray(0, HBC_MAGIC.length).equals(HBC_MAGIC)
  )
    return undefined;
  return bytes.readUInt32LE(HBC_MAGIC.length);
}

function installedVersion(name: string): string {
  return (appShellRequire(`${name}/package.json`) as { version: string })
    .version;
}

export function installedRuntime(): Omit<RuntimePins, 'hermesBytecodeVersion'> {
  return {
    reactNative: installedVersion(RUNTIME_PACKAGES.reactNative),
    react: installedVersion(RUNTIME_PACKAGES.react),
    reanimated: installedVersion(RUNTIME_PACKAGES.reanimated),
    worklets: installedVersion(RUNTIME_PACKAGES.worklets),
  };
}
