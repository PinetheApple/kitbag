import { describe, expect, it } from 'vitest';

import {
  PLAY_ALONG_VIEW,
  playAlongView,
  type PlayAlongViewInputs,
} from './playAlongView.ts';

const base: PlayAlongViewInputs = {
  access: false,
  askedForAccess: false,
  declined: false,
  hasSong: false,
};

describe('playAlongView', () => {
  it('waits while the grant is still being read', () => {
    expect(playAlongView({ ...base, access: undefined })).toBe(
      PLAY_ALONG_VIEW.checking,
    );
  });

  it('explains the grant on a first open without access', () => {
    expect(playAlongView(base)).toBe(PLAY_ALONG_VIEW.explainer);
  });

  it('says access is still off after a trip to Settings that did not grant it', () => {
    expect(playAlongView({ ...base, askedForAccess: true })).toBe(
      PLAY_ALONG_VIEW.stillOff,
    );
  });

  it('degrades to tap tempo after Not now, even after a trip to Settings', () => {
    expect(
      playAlongView({ ...base, askedForAccess: true, declined: true }),
    ).toBe(PLAY_ALONG_VIEW.denied);
  });

  it('shows Nothing playing when access is granted and no song is followed', () => {
    expect(playAlongView({ ...base, access: true, declined: true })).toBe(
      PLAY_ALONG_VIEW.nothing,
    );
  });

  it('shows the song once access is granted and a session is followed', () => {
    expect(playAlongView({ ...base, access: true, hasSong: true })).toBe(
      PLAY_ALONG_VIEW.song,
    );
  });
});
