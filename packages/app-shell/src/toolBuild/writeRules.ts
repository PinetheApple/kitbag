import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { BUNDLE_RULES } from './bundleRules.ts';
import { APP_SHELL_DIR } from './paths.ts';

const RULES_FILE = path.join(APP_SHELL_DIR, 'tool-bundle-rules.json');
const EXIT_STALE = 1;

const rendered = `${JSON.stringify(BUNDLE_RULES, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = existsSync(RULES_FILE)
    ? readFileSync(RULES_FILE, 'utf8')
    : '';
  if (current !== rendered) {
    console.error(
      `stale: ${RULES_FILE} does not match bundleRules.ts. Run: pnpm --filter @kitbag/app-shell generate`,
    );
    process.exitCode = EXIT_STALE;
  }
} else {
  writeFileSync(RULES_FILE, rendered);
  console.log(`wrote ${RULES_FILE}`);
}
