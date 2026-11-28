// --check byte-diffs a fresh render against the committed outputs, so a header
// change or a hand edit fails CI instead of shipping (SPEC §13.7).

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  collectConstants,
  renderConstants,
  type NativeSources,
} from './native-constants.ts';
import { renderToolRulesCpp } from './tool-rules-cpp.ts';
import { renderToolRulesKotlin } from './tool-rules-kotlin.ts';

const pkgRoot = join(import.meta.dirname, '..');
const repoRoot = join(pkgRoot, '..', '..');
const nativeRoot = join(repoRoot, 'native', 'audio_core');
const kotlinRoot = join(pkgRoot, 'android/src/main/java/com/kitbag/corenative');
const rulesFile = join(
  repoRoot,
  'packages',
  'app-shell',
  'tool-bundle-rules.json',
);

const read = (...parts: string[]): string =>
  readFileSync(join(nativeRoot, ...parts), 'utf8');

const sources: NativeSources = {
  apiHeader: read('include', 'kitbag_api.h'),
  tunerHeader: read('include', 'kitbag_tuner_api.h'),
  polyHeader: read('include', 'kitbag_metronome_poly_api.h'),
  gridHeader: read('include', 'kitbag_metronome_grid_api.h'),
  mixerHeader: read('src', 'mixer', 'mixer.h'),
  metronomeHeader: read('src', 'metronome', 'metronome.h'),
  metronomeRender: read('src', 'metronome', 'metronome_render.cpp'),
  tuningModeHeader: read('src', 'tuner', 'tuning_mode.h'),
  tunerImplHeader: read('src', 'tuner', 'tuner.h'),
  tempoRampHeader: read('src', 'metronome', 'tempo_ramp.h'),
  metronomeTypesHeader: read('src', 'metronome', 'metronome_types.h'),
  transportPlanHeader: read('src', 'mixer', 'transport_plan.h'),
  mixdownHeader: read('include', 'kitbag_mixdown_api.h'),
  clickSoundHeader: read('include', 'kitbag_click_sound_api.h'),
  constantTempoHeader: read('include', 'kitbag_constant_tempo_api.h'),
  metronomeSlotHeader: read('include', 'kitbag_metronome_slot_api.h'),
  outputRoutes: readFileSync(
    join(kotlinRoot, 'route', 'OutputRoutes.kt'),
    'utf8',
  ),
  toolEvalHeader: readFileSync(
    join(pkgRoot, 'cpp', 'KitbagToolEval.h'),
    'utf8',
  ),
};

const outputs: readonly (readonly [string, string])[] = [
  [
    join(pkgRoot, 'src', 'generated', 'nativeConstants.gen.ts'),
    renderConstants(collectConstants(sources)),
  ],
  [
    join(kotlinRoot, 'tools', 'ToolBundleRules.gen.kt'),
    renderToolRulesKotlin(readFileSync(rulesFile, 'utf8')),
  ],
  [
    join(pkgRoot, 'cpp', 'ToolBundleRules.gen.h'),
    renderToolRulesCpp(readFileSync(rulesFile, 'utf8')),
  ],
];

function readOrEmpty(file: string): string {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

if (process.argv.includes('--check')) {
  const stale = outputs.filter(
    ([file, rendered]) => readOrEmpty(file) !== rendered,
  );
  for (const [file] of stale) {
    process.stderr.write(`stale: ${file} does not match its source.\n`);
  }
  if (stale.length > 0) {
    process.stderr.write('Run: pnpm --filter @kitbag/core-native generate\n');
    process.exit(1);
  }
  process.stdout.write('generated constants are up to date.\n');
} else {
  for (const [file, rendered] of outputs) {
    writeFileSync(file, rendered);
    process.stdout.write(`wrote ${file}\n`);
  }
}
