import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { probeGlobals, stubModule } from './globalsProbe';

const SPIKE_OUTPUT = path.join(
  import.meta.dirname,
  'fixtures/spike-723-output.bundle',
);
const SPIKE_REGISTRY_KEY = '__kitbagSpike';

function installSpikeHost(global: Record<string, unknown>): void {
  global[SPIKE_REGISTRY_KEY] = {
    modules: new Proxy({}, { get: () => stubModule() }),
  };
}

describe('probeGlobals', () => {
  it("reports the module-system globals the #723 spike's output leaves on the host", () => {
    const probe = probeGlobals(
      readFileSync(SPIKE_OUTPUT, 'utf8'),
      installSpikeHost,
    );
    expect(probe.added).toEqual(
      expect.arrayContaining(['__r', '__c', '__registerSegment']),
    );
  });

  it('reports a global the bundle overwrites', () => {
    const probe = probeGlobals(
      'globalThis.existing = 2;',
      (global: Record<string, unknown>) => {
        global.existing = 1;
      },
    );
    expect(probe).toEqual({ added: [], changed: ['existing'] });
  });

  it('reports nothing for a bundle that keeps to its own scope', () => {
    const probe = probeGlobals(
      '(function () { var local = 1; })();',
      () => undefined,
    );
    expect(probe).toEqual({ added: [], changed: [] });
  });
});
