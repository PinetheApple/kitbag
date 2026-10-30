import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ATTRIBUTIONS } from './attributions.ts';

const THIRD_PARTY = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'native',
  'audio_core',
  'third_party',
);
const LICENCE_FILE = /^(LICEN[CS]E|COPYING)(\..+)?$/i;

const isFile = (path: string) => statSync(path).isFile();

// A single-header library carries its licence inside the header.
function vendoredLibraries(): string[] {
  const headers = readdirSync(THIRD_PARTY).filter((entry) =>
    isFile(join(THIRD_PARTY, entry)),
  );
  const licensed = readdirSync(THIRD_PARTY, { recursive: true })
    .map((entry) => join(THIRD_PARTY, String(entry)))
    .filter((path) => isFile(path) && LICENCE_FILE.test(basename(path)))
    .map((path) => relative(THIRD_PARTY, dirname(path)));
  return [...headers, ...licensed].sort();
}

describe('attributions', () => {
  it('list every vendored native library and nothing that is not vendored', () => {
    expect(existsSync(THIRD_PARTY)).toBe(true);
    const listed = ATTRIBUTIONS.flatMap((a) =>
      a.vendoredAt === undefined ? [] : [a.vendoredAt],
    ).sort();
    expect(listed).toEqual(vendoredLibraries());
  });
});
