import { KB_MIXDOWN_STATE, KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXPORT_POLL_MS, exportBlock } from './exportActions.ts';
import { exportFailureCopy } from './exportText.ts';
import { CODES } from '../songLibrary/store.test-helper.ts';
import { opened, stem } from './store.test-helper.ts';

const DONE = KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_DONE;
const FAILED = KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_FAILED;
const CANCELLED = KB_MIXDOWN_STATE.KB_MIXDOWN_STATE_CANCELLED;
const PATH = '/cache/exports/Song.wav';
const SHORT_CAP_BYTES = 20;
const TEN_SECONDS_AT_RATE_BYTES = 441_000 * 4 + 44;

type Opened = Awaited<ReturnType<typeof opened>>;

function poll(times = 1) {
  vi.advanceTimersByTime(EXPORT_POLL_MS * times);
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function exporting(stems = [stem(1), stem(2)]): Promise<Opened> {
  const p = await opened(stems);
  await p.store.getState().startExport();
  return p;
}

function rejection(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function announced(p: Opened): unknown[] {
  return p.mixdown.announce.mock.calls.map(([message]) => message);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('exporting the mix', () => {
  it('starts with the song name, polls, and shares the file when done', async () => {
    const p = await exporting();
    expect(p.mixdown.start.mock.calls).toEqual([['Song.wav']]);
    expect(p.store.getState().exportState).toEqual({
      kind: 'running',
      song: { setId: 7, title: 'Song' },
      fileName: 'Song.wav',
      path: PATH,
      bytes: TEN_SECONDS_AT_RATE_BYTES,
    });
    expect(announced(p)).toEqual(['Exporting mix']);

    p.mixdownEngine.state = DONE;
    poll();
    await settle();

    expect(p.store.getState().exportState.kind).toBe('ready');
    expect(p.mixdown.share.mock.calls).toEqual([[PATH]]);
    expect(announced(p)).toEqual(['Exporting mix', 'Mix ready']);
  });

  it('names the speed and key it reads from the engine', async () => {
    const p = await opened([stem(1), stem(2)]);
    p.commands.mixerRate.mockResolvedValue(0.75);
    p.commands.mixerTrackPitch.mockResolvedValue(-2);
    await p.store.getState().startExport();
    expect(p.mixdown.start.mock.calls).toEqual([['Song (0.75x, -2 st).wav']]);
  });

  it('caps the name at the limit the native side reports', async () => {
    const p = await opened([stem(1)], { title: 'x'.repeat(400) });
    p.mixdown.codes.mockReturnValue({
      ...CODES,
      exportMaxBaseNameBytes: SHORT_CAP_BYTES,
    });
    await p.store.getState().startExport();
    expect(p.mixdown.start.mock.calls).toEqual([
      [`${'x'.repeat(SHORT_CAP_BYTES)}.wav`],
    ]);
  });

  it('waits on the card when the app is not on screen', async () => {
    const p = await exporting();
    p.mixdown.foreground.mockReturnValue(false);
    p.mixdownEngine.state = DONE;
    poll();
    await settle();
    expect(p.store.getState().exportState.kind).toBe('ready');
    expect(p.mixdown.share).not.toHaveBeenCalled();

    await p.store.getState().shareExport();
    expect(p.mixdown.share.mock.calls).toEqual([[PATH]]);
  });

  it('keeps the file when no app takes it, and shares it again on request', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await exporting();
    p.mixdown.share.mockRejectedValueOnce(rejection(CODES.exportNoShareTarget));
    p.mixdownEngine.state = DONE;
    poll();
    await settle();
    expect(p.store.getState().exportState).toMatchObject({
      kind: 'unshared',
      noTarget: true,
    });
    expect(announced(p)).toContain('No app can take this file');

    await p.store.getState().shareExport();
    expect(p.store.getState().exportState.kind).toBe('ready');
  });

  it('words any other share failure as a plain failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await exporting();
    p.mixdown.share.mockRejectedValueOnce(rejection(CODES.exportShareFailed));
    p.mixdownEngine.state = DONE;
    poll();
    await settle();
    expect(p.store.getState().exportState).toMatchObject({
      kind: 'unshared',
      noTarget: false,
    });
    expect(announced(p)).toContain('Could not share the mix');
    expect(announced(p)).not.toContain('No app can take this file');
  });

  it('keeps polling after the player closes', async () => {
    const p = await exporting();
    p.store.getState().close();
    expect(p.store.getState().exportState.kind).toBe('running');
    p.mixdownEngine.state = DONE;
    poll();
    await settle();
    expect(p.store.getState().exportState.kind).toBe('ready');
  });

  it('fails when the engine reports a failure after it started', async () => {
    const p = await exporting();
    p.mixdownEngine.state = FAILED;
    poll();
    expect(p.store.getState().exportState).toMatchObject({
      kind: 'failed',
      failure: 'internal',
    });
    expect(announced(p)).toContain('Export failed');
  });

  it('announces the start, every quarter reached, and the result', async () => {
    const p = await exporting();
    for (const progress of [0.1, 0.25, 0.3, 0.8, 1]) {
      p.mixdownEngine.progress = progress;
      poll();
    }
    p.mixdownEngine.state = DONE;
    poll();
    await settle();
    expect(announced(p)).toEqual([
      'Exporting mix',
      'Export 25 percent done',
      'Export 75 percent done',
      'Mix ready',
    ]);
  });
});

describe('cancelling an export', () => {
  it('cancels the render and clears the card at once', async () => {
    const p = await exporting();
    p.store.getState().cancelExport();
    expect(p.mixdown.cancel).toHaveBeenCalledOnce();
    expect(p.store.getState().exportState).toEqual({ kind: 'cancelled' });

    p.mixdownEngine.state = CANCELLED;
    poll(2);
    expect(p.store.getState().exportState).toEqual({ kind: 'cancelled' });

    p.store.getState().dismissExport();
    expect(p.store.getState().exportState).toEqual({ kind: 'idle' });
  });

  it('starts again only once the cancelled render has stopped', async () => {
    const p = await exporting();
    p.store.getState().cancelExport();
    const again = p.store.getState().startExport();
    await settle();
    expect(p.mixdown.start).toHaveBeenCalledOnce();

    p.mixdownEngine.state = CANCELLED;
    poll();
    await again;
    expect(p.mixdown.start).toHaveBeenCalledTimes(2);
    expect(p.store.getState().exportState.kind).toBe('running');
  });
});

describe('a render that ends unexpectedly', () => {
  it('keeps a file that finished before Cancel reached it', async () => {
    const p = await exporting();
    p.mixdownEngine.state = DONE;
    p.store.getState().cancelExport();
    expect(p.mixdown.cancel).not.toHaveBeenCalled();
    expect(p.store.getState().exportState.kind).toBe('ready');
    expect(p.mixdown.share).not.toHaveBeenCalled();
  });

  it('keeps a file that finished while Cancel was on its way', async () => {
    const p = await exporting();
    p.store.getState().cancelExport();
    p.mixdownEngine.state = DONE;
    poll();
    await settle();
    expect(p.store.getState().exportState).toMatchObject({
      kind: 'ready',
      path: PATH,
    });
    expect(p.mixdown.share).not.toHaveBeenCalled();
  });

  it('fails, stops polling and can start again when the state cannot be read', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await exporting();
    p.mixdown.state.mockImplementationOnce(() => {
      throw new Error('host object gone');
    });
    poll();
    expect(p.store.getState().exportState).toMatchObject({
      kind: 'failed',
      failure: 'internal',
    });
    expect(p.mixdown.cancel).toHaveBeenCalledOnce();
    await p.store.getState().startExport();
    expect(p.mixdown.start).toHaveBeenCalledTimes(2);
    expect(p.store.getState().exportState.kind).toBe('running');
  });
});

describe('a cancelled export after the player', () => {
  it('is forgotten when the player closes', async () => {
    const p = await exporting();
    p.store.getState().cancelExport();
    p.store.getState().close();
    expect(p.store.getState().exportState).toEqual({ kind: 'idle' });
  });

  it('is forgotten when a song opens', async () => {
    const p = await exporting();
    p.store.getState().cancelExport();
    await p.store.getState().open(7, 8);
    expect(p.store.getState().exportState).toEqual({ kind: 'idle' });
  });
});

describe('a refused export', () => {
  it.each([
    [KB_RESULT.KB_ERROR_NO_SPACE, 'noSpace'],
    [KB_RESULT.KB_ERROR_TOO_LONG, 'tooLong'],
    [KB_RESULT.KB_ERROR_BUSY, 'busy'],
    [KB_RESULT.KB_ERROR_INVALID_ARGUMENT, 'internal'],
    [KB_RESULT.KB_ERROR_INTERNAL, 'internal'],
  ] as const)('maps result %i to %s', async (result, failure) => {
    const p = await opened([stem(1)]);
    p.mixdown.start.mockResolvedValueOnce({ result });
    await p.store.getState().startExport();
    expect(p.store.getState().exportState).toEqual({
      kind: 'failed',
      song: { setId: 7, title: 'Song' },
      failure,
      bytes: TEN_SECONDS_AT_RATE_BYTES,
    });
    expect(announced(p)).toEqual([
      exportFailureCopy(failure, TEN_SECONDS_AT_RATE_BYTES).title,
    ]);
  });

  it('treats a rejected file name as an internal failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const p = await opened([stem(1)]);
    p.mixdown.start.mockRejectedValueOnce(new Error('E_BAD_FILE_NAME'));
    await p.store.getState().startExport();
    expect(p.store.getState().exportState).toMatchObject({
      kind: 'failed',
      failure: 'internal',
    });
  });

  it.each([
    ['no space', 'noSpace', 'Not enough space', 'The mix needs about 1.8 MB'],
    ['too long', 'tooLong', 'Too long for one WAV file', 'about 1.8 MB'],
    ['busy', 'busy', 'Another export is running', 'Wait for it to finish'],
    ['internal', 'internal', 'Export failed', 'Something went wrong'],
  ] as const)('words a %s failure', (_, failure, title, body) => {
    const copy = exportFailureCopy(failure, TEN_SECONDS_AT_RATE_BYTES);
    expect(copy.title).toBe(title);
    expect(copy.body).toContain(body);
    expect(copy.body).toContain('Nothing was saved.');
  });
});

describe('exportBlock', () => {
  it('blocks while an export runs', async () => {
    const p = await exporting();
    expect(exportBlock(p.store.getState())).toBe('running');
  });

  it('blocks when every stem is muted, and does not start', async () => {
    const p = await opened([
      stem(1, { muted: true }),
      stem(2, { muted: true }),
    ]);
    expect(exportBlock(p.store.getState())).toBe('allMuted');
    await p.store.getState().startExport();
    expect(p.mixdown.start).not.toHaveBeenCalled();
  });

  it('blocks when no stem file opened', async () => {
    const p = await opened([stem(1)]);
    p.store.setState({
      stems: p.store.getState().stems.map((row) => ({ ...row, loaded: false })),
    });
    expect(exportBlock(p.store.getState())).toBe('noStems');
  });

  it('blocks with its own reason when every soloed stem is muted', async () => {
    const p = await opened([stem(1, { soloed: true, muted: true }), stem(2)]);
    expect(exportBlock(p.store.getState())).toBe('soloMuted');
  });

  it('does not block when a soloed stem plays', async () => {
    const p = await opened([
      stem(1, { soloed: true, muted: true }),
      stem(2, { soloed: true }),
    ]);
    expect(exportBlock(p.store.getState())).toBeNull();
  });

  it('lets a mix with one stem playing through', async () => {
    const p = await opened([stem(1, { muted: true }), stem(2)]);
    expect(exportBlock(p.store.getState())).toBeNull();
  });
});

describe('readExportSummary', () => {
  it('reads speed and key from the engine and counts the mix', async () => {
    const p = await opened([
      stem(1, { muted: true }),
      stem(2, { soloed: true }),
      stem(3),
    ]);
    p.commands.mixerRate.mockResolvedValue(0.5);
    p.commands.mixerTrackPitch.mockResolvedValue(3);
    const summary = await p.store.getState().readExportSummary();
    expect(summary).toMatchObject({
      speed: 0.5,
      key: 3,
      stems: 3,
      muted: 1,
      soloed: 1,
      loopSet: false,
      lengthSec: 20,
      bytes: 882_000 * 4 + 44,
      fileName: 'Song (0.5x, +3 st).wav',
    });
  });

  it('reads the song key past a drum stem, which is never transposed', async () => {
    const p = await opened([
      stem(1, { role: 'vocals' }),
      stem(2, { role: 'drums' }),
    ]);
    p.commands.mixerTrackPitch.mockImplementation((track) =>
      Promise.resolve(track === 0 ? -2 : 0),
    );
    const summary = await p.store.getState().readExportSummary();
    expect(summary).toMatchObject({ key: -2, fileName: 'Song (-2 st).wav' });
  });

  it('reads an unshifted key for a song of drums only', async () => {
    const p = await opened([stem(1, { role: 'drums' })]);
    p.commands.mixerTrackPitch.mockResolvedValue(3);
    const summary = await p.store.getState().readExportSummary();
    expect(summary).toMatchObject({ key: 0, fileName: 'Song.wav' });
    expect(p.commands.mixerTrackPitch).not.toHaveBeenCalled();
  });

  it('reports no single key when the stems are keyed differently', async () => {
    const p = await opened([stem(1), stem(2)]);
    p.commands.mixerTrackPitch
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    const summary = await p.store.getState().readExportSummary();
    expect(summary.key).toBeNull();
  });
});
