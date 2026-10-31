// --check byte-diffs a fresh render against the committed .gen.ts, so a header
// change or a hand edit fails CI instead of shipping (SPEC §13.7).

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
  tunerHeader: read('include', 'kitbag_tuner_api.h'),
  polyHeader: read('include', 'kitbag_metronome_poly_api.h'),
  mixerHeader: read('src', 'mixer', 'mixer.h'),
  metronomeHeader: read('src', 'metronome', 'metronome.h'),
  metronomeRender: read('src', 'metronome', 'metronome_render.cpp'),
  tuningModeHeader: read('src', 'tuner', 'tuning_mode.h'),
  tunerImplHeader: read('src', 'tuner', 'tuner.h'),
  tempoRampHeader: read('src', 'metronome', 'tempo_ramp.h'),
  metronomeTypesHeader: read('src', 'metronome', 'metronome_types.h'),
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
