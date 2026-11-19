import type { DataFolderVolumes } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { CARD, move } from '../settings/dataFolderMove.test-helper.ts';
import { libraryStrip, type StripInput } from './libraryStrip.ts';

const ON_CARD: DataFolderVolumes = {
  currentVolumeUuid: CARD,
  currentAvailable: true,
  requiredBytes: 0,
  volumes: [],
};
const CARD_OUT: DataFolderVolumes = { ...ON_CARD, currentAvailable: false };

const input = (fields: Partial<StripInput>): StripInput => ({
  move: null,
  volumes: ON_CARD,
  unavailable: 0,
  view: 'songs',
  ...fields,
});

describe('the Songs list strip', () => {
  it('shows nothing with no move and the folder in place', () => {
    expect(libraryStrip(input({}))).toEqual({ kind: 'none' });
  });

  it('shows a running move’s bytes and progress', () => {
    expect(libraryStrip(input({ move: move() }))).toEqual({
      kind: 'move',
      title: 'Moving files to SD card',
      detail: '540 MB of 1.2 GB · songs still play',
      percent: 45,
    });
  });

  it('shows a paused move with how far it got', () => {
    const paused = move({ running: false, paused: true });
    expect(libraryStrip(input({ move: paused }))).toEqual({
      kind: 'move',
      title: 'Move to SD card paused',
      detail: '540 MB of 1.2 GB · songs still play',
      percent: 45,
    });
  });

  it('says the files switched while the old copies wait for the players', () => {
    const switched = move({
      running: false,
      switched: true,
      awaitingRelease: true,
    });
    expect(libraryStrip(input({ move: switched }))).toEqual({
      kind: 'move',
      title: 'Files moved to SD card',
      detail: 'Old copies go once nothing plays',
      percent: null,
    });
  });

  it('says the old copies were left when their clean-up failed', () => {
    const left = move({ running: false, switched: true, error: 'E_MOVE_IO' });
    expect(libraryStrip(input({ move: left }))).toMatchObject({
      detail: 'Old copies left',
    });
  });

  it('counts the songs a missing card holds', () => {
    expect(libraryStrip(input({ volumes: CARD_OUT, unavailable: 23 }))).toEqual(
      {
        kind: 'missing',
        title: 'SD card not found',
        detail: '23 songs on it can’t play until it’s back',
      },
    );
  });

  it('names stem songs on the Stem songs list', () => {
    expect(
      libraryStrip(input({ volumes: CARD_OUT, unavailable: 1, view: 'stems' })),
    ).toMatchObject({ detail: '1 stem song on it can’t play until it’s back' });
  });

  it('gives no count line before any song on the card is counted', () => {
    expect(libraryStrip(input({ volumes: CARD_OUT }))).toEqual({
      kind: 'missing',
      title: 'SD card not found',
      detail: null,
    });
  });

  it('puts a missing card before a move', () => {
    const paused = move({ running: false, paused: true });
    expect(
      libraryStrip(input({ move: paused, volumes: CARD_OUT })),
    ).toMatchObject({ kind: 'missing' });
  });

  it('shows no strip for songs left on a card after switching away', () => {
    const internal = { ...ON_CARD, currentVolumeUuid: null };
    expect(libraryStrip(input({ volumes: internal, unavailable: 3 }))).toEqual({
      kind: 'none',
    });
  });
});
