import { KB_MIXDOWN_STATE, KB_RESULT } from '@kitbag/core-native';
import { CODES } from '@kitbag/core-state/src/songLibrary/store.test-helper.ts';
import { EXPORT_POLL_MS } from '@kitbag/core-state';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  flush,
  mountTracked,
  unmountTracked,
  type Player,
} from './playerHarness.test-helper.tsx';

const MENU = 'Player menu';
const EXPORT_ROW = 'Export mix as a WAV file';
const EXPORT = 'Export the mix';
const CANCEL = 'Cancel the export';
const RUNNING_NOTE =
  'Keep playing if you like; this does not change the file. The share sheet opens when it is done.';

let player: Player | undefined;

async function poll(p: Player, times = 1) {
  act(() => {
    vi.advanceTimersByTime(EXPORT_POLL_MS * times);
  });
  await flush();
  return p;
}

async function exportFromMenu(): Promise<Player> {
  const p = await mountTracked();
  player = p;
  await p.press(MENU);
  await p.press(EXPORT_ROW);
  await p.press(EXPORT);
  return p;
}

function rowState(p: Player, label: string): unknown {
  return p.byLabel(label).props.accessibilityState;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});

afterEach(async () => {
  const p = player;
  player = undefined;
  if (p !== undefined) {
    p.mixdownEngine.state = KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_CANCELLED;
    await poll(p);
    p.store.setState({ exportState: { kind: 'idle' } });
    p.store.getState().close();
  }
  unmountTracked();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the Export mix menu row', () => {
  it('opens the confirm sheet with what the file will hold', async () => {
    const p = await mountTracked();
    player = p;
    await p.press(MENU);
    expect(p.has('WAV')).toBe(true);
    expect(rowState(p, EXPORT_ROW)).toEqual({ disabled: false });

    p.commands.mixerRate.mockResolvedValue(0.75);
    p.commands.mixerTrackPitch.mockResolvedValue(-2);
    await p.press(EXPORT_ROW);
    for (const text of [
      'Export mix',
      '0.75×',
      '−2 semitones',
      '2',
      'Whole song',
      '0:13',
      'Click not included',
      'WAV · 16-bit · 44.1 kHz',
      'about 2.4 MB',
    ])
      expect(p.has(text)).toBe(true);
  });

  it('is disabled with the reason when every stem is muted', async () => {
    const p = await mountTracked();
    player = p;
    act(() => {
      p.store.getState().toggleMute(0);
      p.store.getState().toggleMute(1);
    });
    await p.press(MENU);
    expect(rowState(p, 'Export mix: every stem muted')).toEqual({
      disabled: true,
    });
  });

  it('is disabled with the progress while an export runs', async () => {
    const p = await exportFromMenu();
    p.mixdownEngine.progress = 0.42;
    await poll(p);
    await p.press(MENU);
    expect(rowState(p, 'Export mix: exporting, 42%')).toEqual({
      disabled: true,
    });
  });
});

describe('the export card', () => {
  it('shows progress with playback left alone, then the file when done', async () => {
    const p = await exportFromMenu();
    expect(p.mixdown.start.mock.calls).toEqual([['Song.wav']]);
    expect(p.has('Exporting mix')).toBe(true);
    expect(p.has(RUNNING_NOTE)).toBe(true);
    expect(p.commands.mixerPause).not.toHaveBeenCalled();

    p.mixdownEngine.progress = 0.5;
    await poll(p);
    expect(p.has('50%')).toBe(true);

    p.mixdownEngine.state = KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_DONE;
    await poll(p);
    expect(p.has('Mix ready')).toBe(true);
    expect(p.has('Song.wav · 1.8 MB')).toBe(true);
    expect(p.mixdown.share.mock.calls).toEqual([['/cache/exports/Song.wav']]);

    await p.press('Share the mix');
    expect(p.mixdown.share).toHaveBeenCalledTimes(2);
    await p.press('Dismiss');
    expect(p.has('Mix ready')).toBe(false);
  });

  it('clears at once on Cancel and says nothing was saved', async () => {
    const p = await exportFromMenu();
    await p.press(CANCEL);
    expect(p.mixdown.cancel).toHaveBeenCalledOnce();
    expect(p.has('Exporting mix')).toBe(false);
    expect(p.has('Export cancelled. Nothing was saved.')).toBe(true);
  });

  it('says there is not enough space and offers Retry', async () => {
    const p = await mountTracked();
    player = p;
    p.mixdown.start.mockResolvedValueOnce({
      result: KB_RESULT.KB_ERROR_NO_SPACE,
    });
    await p.press(MENU);
    await p.press(EXPORT_ROW);
    await p.press(EXPORT);
    expect(p.has('Not enough space')).toBe(true);

    await p.press('Retry the export');
    expect(p.mixdown.start).toHaveBeenCalledTimes(2);
    expect(p.has('Exporting mix')).toBe(true);
  });

  it('disables Retry with the reason while the mix is silent', async () => {
    const p = await mountTracked();
    player = p;
    p.mixdown.start.mockResolvedValueOnce({
      result: KB_RESULT.KB_ERROR_INTERNAL,
    });
    await p.press(MENU);
    await p.press(EXPORT_ROW);
    await p.press(EXPORT);
    act(() => {
      p.store.getState().toggleMute(0);
      p.store.getState().toggleMute(1);
    });
    expect(rowState(p, 'Retry the export: every stem muted')).toEqual({
      disabled: true,
    });
    expect(p.has('Retry')).toBe(true);
  });

  it('keeps the file and says why when no app takes it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await exportFromMenu();
    p.mixdown.share.mockRejectedValueOnce(
      Object.assign(new Error('no target'), {
        code: CODES.exportNoShareTarget,
      }),
    );
    p.mixdownEngine.state = KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_DONE;
    await poll(p);
    expect(p.has('No app can take this file')).toBe(true);
    expect(p.has('Share again')).toBe(true);
  });

  it('names the song and offers no Retry when another song is open', async () => {
    const p = await mountTracked();
    player = p;
    act(() => {
      p.store.setState({
        exportState: {
          kind: 'failed',
          song: { setId: 99, title: 'Other' },
          failure: 'internal',
          bytes: 0,
        },
      });
    });
    expect(p.has('Export failed')).toBe(true);
    expect(p.labelled('Retry the export')).toEqual([]);

    act(() => {
      p.store.setState({
        exportState: {
          kind: 'running',
          song: { setId: 99, title: 'Other' },
          fileName: 'Other.wav',
          path: '/cache/exports/Other.wav',
          bytes: 0,
        },
      });
    });
    expect(
      p.has('Exporting “Other”. The share sheet opens when it is done.'),
    ).toBe(true);
  });
});
