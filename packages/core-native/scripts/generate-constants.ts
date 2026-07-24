// Build step: emit src/generated/nativeConstants.gen.ts from the engine source
// (SPEC §13.7). Thin fs wrapper — all logic is in ./native-constants.ts, so the
// generated file cannot drift from the C/C++ that owns each constant.
//
//   node scripts/generate-constants.ts          # write the artifact
//   node scripts/generate-constants.ts --check   # fail if it is stale
//
// --check re-parses the engine source, re-renders, and byte-diffs against the
// committed output. A header change (or a hand-edit to the .gen.ts) is caught
// here rather than shipped. Mirrors core-design/scripts/generate-tailwind.ts.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  collectConstants,
  renderConstants,
  type NativeSources,
} from './native-constants.ts';

const pkgRoot = join(import.meta.dirname, '..');
const repoRoot = join(pkgRoot, '..', '..');
const nativeRoot = join(repoRoot, 'native', 'audio_core');
const outFile = join(pkgRoot, 'src', 'generated', 'nativeConstants.gen.ts');

const read = (...parts: string[]): string =>
  readFileSync(join(nativeRoot, ...parts), 'utf8');

const sources: NativeSources = {
  apiHeader: read('include', 'kitbag_api.h'),
  mixerHeader: read('src', 'mixer', 'mixer.h'),
  metronomeHeader: read('src', 'metronome', 'metronome.h'),
  metronomeRender: read('src', 'metronome', 'metronome_render.cpp'),
};

const rendered = renderConstants(collectConstants(sources));
const check = process.argv.includes('--check');

if (check) {
  let current = '';
  try {
    current = readFileSync(outFile, 'utf8');
  } catch {
    current = '';
  }
  if (current !== rendered) {
    process.stderr.write(
      `stale: ${outFile} does not match the engine source.\n` +
        'Run: pnpm --filter @kitbag/core-native generate\n',
    );
    process.exit(1);
  }
  process.stdout.write('nativeConstants.gen.ts is up to date.\n');
} else {
  writeFileSync(outFile, rendered);
  process.stdout.write(`wrote ${outFile}\n`);
}
