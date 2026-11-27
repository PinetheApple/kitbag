import type { PickedDocument } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { planIntake } from './plan.ts';

const JSON_MIME = 'application/json';

const doc = (name: string, mimeType: string): PickedDocument => ({
  uri: `content://shared/${name}`,
  name,
  mimeType,
});

const SONG = doc('Everlong.mp3', 'audio/mpeg');
const STEMS = doc('Redbone.stemdeck.zip', 'application/zip');
const BARE_ZIP = doc('Redbone', 'application/x-zip-compressed');
const BACKUP = doc('kitbag_export.json', JSON_MIME);
const NAMED_BACKUP = doc('kitbag_export.json', 'application/octet-stream');
const TYPED_BACKUP = doc('export', 'application/json; charset=utf-8');
const UNKNOWN = doc('notes.txt', 'text/plain');

describe('planning what was opened or shared', () => {
  it('imports audio as songs', () => {
    expect(planIntake([SONG], JSON_MIME)).toEqual({
      kind: 'import',
      docs: [SONG],
      hasSongs: true,
      hasStemSongs: false,
    });
  });

  it.each([
    ['a .stemdeck.zip', STEMS],
    ['a zip by its type alone', BARE_ZIP],
  ])('imports %s as a stem song', (_case, bundle) => {
    expect(planIntake([bundle], JSON_MIME)).toEqual({
      kind: 'import',
      docs: [bundle],
      hasSongs: false,
      hasStemSongs: true,
    });
  });

  it('keeps a mixed share in its order and splits it by tool', () => {
    expect(planIntake([STEMS, SONG], JSON_MIME)).toEqual({
      kind: 'import',
      docs: [STEMS, SONG],
      hasSongs: true,
      hasStemSongs: true,
    });
  });

  it.each([
    ['its JSON type', BACKUP],
    ['its .json name', NAMED_BACKUP],
    ['a JSON type with parameters', TYPED_BACKUP],
  ])('opens a backup by %s for restore', (_case, backup) => {
    expect(planIntake([backup], JSON_MIME)).toEqual({
      kind: 'restore',
      backup,
      skipped: [],
    });
  });

  it('opens only the first backup and imports nothing shared beside it', () => {
    expect(planIntake([SONG, BACKUP, STEMS, NAMED_BACKUP], JSON_MIME)).toEqual({
      kind: 'restore',
      backup: BACKUP,
      skipped: [SONG, STEMS, NAMED_BACKUP],
    });
  });

  it('sends a file of an unknown type to the song import, which refuses it by format', () => {
    expect(planIntake([UNKNOWN], JSON_MIME)).toMatchObject({
      kind: 'import',
      hasSongs: true,
    });
  });

  it('does nothing for an empty share', () => {
    expect(planIntake([], JSON_MIME)).toEqual({ kind: 'none' });
  });
});
