import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_SETS = join(import.meta.dirname, '..', 'android', 'app', 'src');
const OVERLAY = 'android.permission.SYSTEM_ALERT_WINDOW';

function declaresOverlay(sourceSet: string): boolean {
  const manifest = readFileSync(
    join(SOURCE_SETS, sourceSet, 'AndroidManifest.xml'),
    'utf8',
  );
  return (manifest.match(/<uses-permission\b[^>]*>/g) ?? []).some(
    (tag) =>
      tag.includes(`android:name="${OVERLAY}"`) &&
      !tag.includes('tools:node="remove"'),
  );
}

describe('draw-over-other-apps permission', () => {
  it('is not declared by the release manifest', () => {
    expect(declaresOverlay('main')).toBe(false);
  });

  it.each(['debug', 'debugOptimized'])('stays declared in %s', (sourceSet) => {
    expect(declaresOverlay(sourceSet)).toBe(true);
  });
});
