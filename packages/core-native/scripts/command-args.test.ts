import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

const pkgRoot = join(import.meta.dirname, '..');
const repoRoot = join(pkgRoot, '..', '..');
const cppDir = join(pkgRoot, 'cpp');
const audioCore = join(repoRoot, 'native', 'audio_core');
const buildDir = join(pkgRoot, 'node_modules', '.cache', 'command-args-test');
const binary = join(buildDir, 'commandArgsTest');
const COMPILE_AND_RUN_TIMEOUT_MS = 120_000;

it(
  'the command layer refuses what a cast would corrupt',
  () => {
    mkdirSync(buildDir, { recursive: true });
    // gc-sections drops every command the test never calls, so only the ABI it stubs is linked.
    execFileSync('c++', [
      '-std=c++20',
      '-ffunction-sections',
      '-Wl,--gc-sections',
      `-I${cppDir}`,
      `-I${join(audioCore, 'include')}`,
      `-I${join(repoRoot, 'node_modules', 'react-native', 'ReactCommon', 'jsi')}`,
      join(cppDir, 'KitbagCommands.cpp'),
      join(cppDir, 'test', 'commandArgsTest.cpp'),
      '-o',
      binary,
    ]);
    expect(() => execFileSync(binary, { stdio: 'pipe' })).not.toThrow();
  },
  COMPILE_AND_RUN_TIMEOUT_MS,
);
