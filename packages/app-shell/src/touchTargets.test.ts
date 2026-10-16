import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const PACKAGES = join(import.meta.dirname, '..', '..');

// Each of these keeps its slop inside the frame of its nearest native ancestor
// and clear of later siblings (#126). Anything new uses core-design hitBoxStyle.
const AUDITED_HIT_SLOP: Readonly<Record<string, number>> = {
  'core-design/src/components/NumpadKeypad.tsx': 3,
  'core-design/src/components/PegSelector.tsx': 1,
  'core-design/src/components/TransportKey.tsx': 1,
  'tool-metronome/src/screen/PracticePill.tsx': 1,
  'tool-metronome/src/screen/SwipeTempoZone.tsx': 1,
};

function hitSlopUses(): Record<string, number> {
  const uses: Record<string, number> = {};
  for (const pkg of readdirSync(PACKAGES)) {
    const src = join(PACKAGES, pkg, 'src');
    if (!existsSync(src)) continue;
    for (const entry of readdirSync(src, { recursive: true })) {
      const file = join(src, String(entry));
      if (!file.endsWith('.tsx')) continue;
      const count = readFileSync(file, 'utf8').match(/\bhitSlop=/g)?.length;
      if (count !== undefined) uses[relative(PACKAGES, file)] = count;
    }
  }
  return uses;
}

describe('hitSlop', () => {
  it('appears only where its reach was audited against the parent frame', () => {
    expect(hitSlopUses()).toEqual(AUDITED_HIT_SLOP);
  });
});
