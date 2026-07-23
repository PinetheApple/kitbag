// Build step: emit the Tailwind theme from §12.2's tokens (SPEC §13.8.1).
//
// This script is a thin fs wrapper — ALL logic lives in the token module
// (src/tokens.ts), so the emitted config cannot drift from §12.2. It writes two
// generated artifacts:
//   - tailwind.config.js  (colour→var refs, radii, type, shadow; NO hex)
//   - theme.css           (the palette hex as CSS vars; dark :root + light @media)
//
//   node scripts/generate-tailwind.ts           # write the artifacts
//   node scripts/generate-tailwind.ts --check    # fail if they are stale
//
// --check makes the generation link enforceable: it re-renders from the tokens
// and diffs against what is committed, so a hand-edit to either artifact (a
// stranded hex literal, SPEC §13.8.1) is caught rather than shipped.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderTailwindConfig, renderThemeCss } from '../src/tokens.ts';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');

const artifacts = [
  {
    file: join(pkgRoot, 'tailwind.config.js'),
    content: renderTailwindConfig(),
  },
  { file: join(pkgRoot, 'theme.css'), content: renderThemeCss() },
];

const check = process.argv.includes('--check');
let stale = false;

for (const { file, content } of artifacts) {
  if (check) {
    let current = '';
    try {
      current = readFileSync(file, 'utf8');
    } catch {
      current = '';
    }
    if (current !== content) {
      stale = true;
      process.stderr.write(`stale: ${file} does not match src/tokens.ts\n`);
    }
  } else {
    writeFileSync(file, content);
    process.stdout.write(`wrote ${file}\n`);
  }
}

if (check && stale) {
  process.stderr.write(
    'Tailwind theme is out of date. ' +
      'Run: pnpm --filter @kitbag/core-design generate\n',
  );
  process.exit(1);
}
