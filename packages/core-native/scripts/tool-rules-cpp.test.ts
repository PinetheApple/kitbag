import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderToolRulesCpp } from './tool-rules-cpp.ts';

const RULES_FILE = join(
  import.meta.dirname,
  '..',
  '..',
  'app-shell',
  'tool-bundle-rules.json',
);
const MAGIC_ARRAY = /kHbcMagic = \{([^}]*)\}/;

function constant(header: string, name: string): number {
  const match = new RegExp(`${name} = (\\d+);`).exec(header);
  if (match?.[1] === undefined) throw new Error(`no ${name}`);
  return Number(match[1]);
}

function rulesWith(hbc: object): string {
  const rules = JSON.parse(readFileSync(RULES_FILE, 'utf8')) as object;
  return JSON.stringify({ ...rules, hbc });
}

describe('renderToolRulesCpp', () => {
  const json = readFileSync(RULES_FILE, 'utf8');
  const rules = JSON.parse(json) as {
    hbc: { magic: string; versionBytes: number };
    limits: { inflatedMaxBytes: number };
  };
  const header = renderToolRulesCpp(json);

  it('writes the hbc magic byte for byte, in file order', () => {
    const listed = MAGIC_ARRAY.exec(header)?.[1] ?? '';
    const bytes = listed.split(',').map((byte) => Number(byte.trim()));
    expect(Buffer.from(bytes)).toEqual(Buffer.from(rules.hbc.magic, 'hex'));
  });

  it('writes the version width and the inflated cap from the rules', () => {
    expect(constant(header, 'kHbcVersionBytes')).toBe(rules.hbc.versionBytes);
    expect(constant(header, 'kInflatedMaxBytes')).toBe(
      rules.limits.inflatedMaxBytes,
    );
  });

  it('refuses a magic that is not whole hex bytes', () => {
    expect(() =>
      renderToolRulesCpp(rulesWith({ magic: 'c61', versionBytes: 4 })),
    ).toThrow('hbc.magic');
  });

  it('refuses a version width that is not a positive integer', () => {
    expect(() =>
      renderToolRulesCpp(rulesWith({ magic: 'c61f', versionBytes: 0 })),
    ).toThrow('hbc.versionBytes');
  });
});
