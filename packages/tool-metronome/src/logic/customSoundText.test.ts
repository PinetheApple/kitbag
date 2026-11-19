import type { ClickSoundProblem } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  clickSoundNoticeView,
  importHint,
  optionsHint,
  preparingText,
  removeText,
  removeTitle,
  tileLabel,
  unavailableText,
} from './customSoundText.ts';

const FORMATS = ['WAV', 'MP3', 'FLAC', 'AIFF'];

function refused(
  fileName: string,
  problem: ClickSoundProblem,
  replacing: string | null = null,
) {
  return clickSoundNoticeView({
    kind: 'refused',
    fileName,
    replacing,
    problem,
  });
}

describe('the mockup copy', () => {
  it('hints formats, length and slots while a slot is free', () => {
    expect(importHint(FORMATS, false)).toBe(
      'WAV, MP3, FLAC or AIFF, up to 2 seconds. You can keep two sounds.',
    );
  });

  it('hints replace or remove once both slots are used', () => {
    expect(importHint(FORMATS, true)).toBe(
      'You can keep two sounds. Replace or remove one to import another.',
    );
  });

  it('names the file being prepared', () => {
    expect(preparingText('Rimshot.wav')).toBe('Preparing “Rimshot.wav”…');
  });

  it('words every refusal as drawn', () => {
    expect(refused('Crash ride.wav', { kind: 'tooLong' }).text).toBe(
      '“Crash ride.wav” is longer than 2 seconds, the most a click sound can be.',
    );
    expect(
      refused('Snare.m4a', {
        kind: 'format',
        format: 'm4a',
        supported: FORMATS,
      }).text,
    ).toBe(
      'Can’t import “Snare.m4a”: M4A isn’t supported. Use WAV, MP3, FLAC or AIFF.',
    );
    expect(refused('Kick.wav', { kind: 'damaged' }).text).toBe(
      '“Kick.wav” could not be decoded and may be damaged, so it was not added.',
    );
    expect(refused('Room tone.wav', { kind: 'silent' }).text).toBe(
      '“Room tone.wav” is silent, so it was not added.',
    );
  });

  it('adds that the old sound is unchanged when a replace fails', () => {
    expect(refused('Crash ride.wav', { kind: 'tooLong' }, 'Rimshot').text).toBe(
      '“Crash ride.wav” is longer than 2 seconds, the most a click sound can be. Rimshot is unchanged.',
    );
  });

  it('tones a refused file amber and a damaged one red', () => {
    expect(refused('a.wav', { kind: 'tooLong' }).tone).toBe('warning');
    expect(refused('a.wav', { kind: 'silent' }).tone).toBe('warning');
    expect(refused('a.wav', { kind: 'damaged' }).tone).toBe('danger');
    expect(clickSoundNoticeView({ kind: 'picker' }).tone).toBe('danger');
  });

  it('labels a tile and its options for the reader', () => {
    expect(tileLabel('Rimshot', true)).toBe('Rimshot, your sound');
    expect(tileLabel('Rimshot', false)).toBe(
      'Rimshot, your sound, unavailable',
    );
  });

  it('says what Replace keeps', () => {
    expect(optionsHint('Rimshot')).toBe(
      'Replace keeps the new sound on every beat and song that uses Rimshot.',
    );
  });

  it('names the roles a removal puts back to Tick', () => {
    expect(removeTitle('Rimshot')).toBe('Remove “Rimshot”?');
    expect(removeText(['normal'])).toBe(
      'Normal beats go back to Tick, on the metronome and in every saved song that uses it. This cannot be undone.',
    );
    expect(removeText(['accent'])).toMatch(/^Accent beats go back to Tick/);
    expect(removeText(['normal', 'accent'])).toMatch(
      /^Normal and accent beats go back to Tick/,
    );
    expect(removeText([])).toBe(
      'Every saved song that uses it goes back to Tick. This cannot be undone.',
    );
  });

  it('says an unloadable sound plays Tick', () => {
    expect(unavailableText('Rimshot')).toBe(
      '“Rimshot” could not be loaded, so it plays as Tick. Replace it or remove it.',
    );
  });
});
