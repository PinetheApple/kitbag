import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

const pkgRoot = join(import.meta.dirname, '..');
const cppDir = join(pkgRoot, 'cpp');
const buildDir = join(pkgRoot, 'node_modules', '.cache', 'verified-tools-test');
const binary = join(buildDir, 'verifiedToolsTest');
const COMPILE_AND_RUN_TIMEOUT_MS = 120_000;

it(
  'the tool store holds one verified bundle per tool and refuses a wrong header',
  () => {
    mkdirSync(buildDir, { recursive: true });
    execFileSync('c++', [
      '-std=c++20',
      `-I${cppDir}`,
      join(cppDir, 'VerifiedTools.cpp'),
      join(cppDir, 'test', 'verifiedToolsTest.cpp'),
      '-o',
      binary,
    ]);
    expect(() => execFileSync(binary, { stdio: 'pipe' })).not.toThrow();
  },
  COMPILE_AND_RUN_TIMEOUT_MS,
);
