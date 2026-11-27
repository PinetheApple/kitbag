import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_SETS = join(import.meta.dirname, '..', 'android', 'app', 'src');
const OVERLAY_NAME =
  /android:name\s*=\s*["']android\.permission\.SYSTEM_ALERT_WINDOW["']/;
const REMOVED = /tools:node\s*=\s*["']remove["']/;

function declaresOverlay(sourceSet: string): boolean {
  const manifest = readFileSync(
    join(SOURCE_SETS, sourceSet, 'AndroidManifest.xml'),
    'utf8',
  );
  return (manifest.match(/<uses-permission\b[^>]*>/g) ?? []).some(
    (tag) => OVERLAY_NAME.test(tag) && !REMOVED.test(tag),
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
