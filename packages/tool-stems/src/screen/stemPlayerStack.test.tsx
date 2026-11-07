import { RETIME_PLAYBACK_RATE, stemPlayerStore } from '@kitbag/core-state';
import { record } from '@kitbag/core-state/src/stemPlayer/store.test-helper.ts';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  flush,
  installFakeRuntime,
  mountPlayer,
  mountSurface,
  playerTree,
  SET_ID,
  SONG_DETAILS,
  STEMS,
  type Player,
} from './playerHarness.test-helper.tsx';

const SECOND_ID = 8;
const FIRST_TITLE = 'First song';
const SECOND_TITLE = 'Second song';
const OPENING = 'Opening the stems…';
const HALF_GAIN = 0.5;
const CLOSES = 5;
const FIRST_RECORD = { title: FIRST_TITLE, lyrics: null };
const SECOND_RECORD = record(STEMS, { title: SECOND_TITLE, lyrics: null });
const DETAILED_RECORD = { ...SONG_DETAILS, title: FIRST_TITLE };

type Surface = Awaited<ReturnType<typeof mountSurface>>;
type CoverOrder = 'acquire before blur' | 'blur before acquire';
type BackOrder = 'release before refocus' | 'refocus before release';

const ORDERS: readonly (readonly [CoverOrder, BackOrder])[] = [
  ['acquire before blur', 'release before refocus'],
  ['acquire before blur', 'refocus before release'],
  ['blur before acquire', 'release before refocus'],
  ['blur before acquire', 'refocus before release'],
];
const BACK_ORDERS: readonly BackOrder[] = [
  'release before refocus',
  'refocus before release',
];

function Gated({
  on,
  focused,
}: {
  readonly on: boolean;
  readonly focused: boolean;
}) {
  return on ? playerTree({ focused }) : null;
}

let first: Player | undefined;
let surface: Surface | undefined;

async function openFirst(change: object = FIRST_RECORD): Promise<Player> {
  first = await mountPlayer(change);
  return first;
}

async function openSurface(setId: number): Promise<void> {
  surface = await mountSurface(playerTree({ setId }));
}

function closeSurface(): void {
  surface?.unmount();
  surface = undefined;
}

async function cover(
  player: Player,
  order: CoverOrder,
  setId = SECOND_ID,
): Promise<void> {
  if (setId === SECOND_ID)
    player.records.readStemSet.mockResolvedValueOnce(SECOND_RECORD);
  if (order === 'blur before acquire') player.setFocused(false);
  await openSurface(setId);
  if (order === 'acquire before blur') player.setFocused(false);
}

async function uncover(player: Player, order: BackOrder): Promise<void> {
  if (order === 'release before refocus') closeSurface();
  player.setFocused(true);
  if (order === 'refocus before release') closeSurface();
  await act(flush);
}

afterEach(() => {
  closeSurface();
  first?.unmount();
  first = undefined;
});

describe('Back to a stem song another was opened over', () => {
  it.each(ORDERS)('reopens the first song once: %s, %s', async (over, back) => {
    const player = await openFirst();
    await cover(player, over);
    expect(player.store.getState().setId).toBe(SECOND_ID);
    await uncover(player, back);
    expect(player.has(OPENING)).toBe(false);
    expect(player.has(FIRST_TITLE)).toBe(true);
    expect(player.store.getState().status).toBe('ready');
    expect(player.store.getState().setId).toBe(SET_ID);
    expect(player.records.readStemSet).toHaveBeenCalledTimes(3);
    expect(player.records.readStemSet).toHaveBeenLastCalledWith(SET_ID);
  });

  it.each(ORDERS)(
    'stops and lets go of the engine on the last Back: %s, %s',
    async (over, back) => {
      const player = await openFirst();
      await cover(player, over);
      await uncover(player, back);
      player.commands.mixerStop.mockClear();
      player.unmount();
      expect(player.store.getState().status).toBe('idle');
      expect(player.commands.mixerStop).toHaveBeenCalledOnce();
      expect(player.commands.engineRelease).toHaveBeenCalledTimes(
        player.commands.engineHold.mock.calls.length,
      );
    },
  );

  it.each(BACK_ORDERS)(
    'reopens when the same song was stacked over it: %s',
    async (back) => {
      const player = await openFirst();
      await cover(player, 'acquire before blur', SET_ID);
      await uncover(player, back);
      expect(player.has(OPENING)).toBe(false);
      expect(player.store.getState().status).toBe('ready');
      expect(player.store.getState().setId).toBe(SET_ID);
      expect(player.records.readStemSet).toHaveBeenCalledTimes(3);
    },
  );

  it('leaves the song on top alone while the first is covered', async () => {
    const player = await openFirst();
    await cover(player, 'acquire before blur');
    expect(player.store.getState().title).toBe(SECOND_TITLE);
    expect(player.store.getState().status).toBe('ready');
    expect(player.records.readStemSet).toHaveBeenCalledTimes(2);
  });

  it('returns stopped with its click off and its saved gain', async () => {
    const player = await openFirst();
    const { getState } = player.store;
    getState().setGain(0, HALF_GAIN);
    await getState().toggleClick();
    getState().togglePlay();
    player.commands.mixerStop.mockClear();
    await cover(player, 'acquire before blur');
    expect(player.commands.mixerStop).toHaveBeenCalled();
    player.commands.mixerPlay.mockClear();
    await uncover(player, 'release before refocus');
    expect(getState().status).toBe('ready');
    expect(getState().stems[0]?.volume).toBe(HALF_GAIN);
    expect(player.commands.mixerSetGain).toHaveBeenLastCalledWith(
      1,
      STEMS[1]?.volume,
    );
    expect(player.commands.mixerSetGain).toHaveBeenCalledWith(0, HALF_GAIN);
    expect(getState().click).toBe(false);
    expect(player.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('returns with its loop gone', async () => {
    const player = await openFirst(DETAILED_RECORD);
    const { getState } = player.store;
    await getState().loopSection(0);
    expect(getState().loop.kind).toBe('on');
    await cover(player, 'acquire before blur');
    await uncover(player, 'release before refocus');
    expect(getState().loop).toEqual({ kind: 'off' });
  });

  it('returns out of a retime it left unsaved', async () => {
    const player = await openFirst(DETAILED_RECORD);
    const { getState } = player.store;
    getState().beginRetime(0);
    expect(getState().retime.kind).toBe('recording');
    await cover(player, 'acquire before blur');
    await uncover(player, 'release before refocus');
    expect(getState().retime).toEqual({ kind: 'off' });
    expect(player.records.saveLyricsRetimed).not.toHaveBeenCalled();
    expect(player.has(FIRST_TITLE)).toBe(true);
  });
});

describe('another route covering the player', () => {
  it('keeps the song playing, with its loop and retime, through Back', async () => {
    const player = await openFirst(DETAILED_RECORD);
    const { getState } = player.store;
    await getState().loopSection(0);
    getState().togglePlay();
    getState().beginRetime(0);
    await act(flush);
    const retime = getState().retime;
    const loop = getState().loop;
    player.commands.mixerStop.mockClear();
    player.commands.mixerSeek.mockClear();
    player.setFocused(false);
    await act(flush);
    player.setFocused(true);
    await act(flush);
    expect(player.records.readStemSet).toHaveBeenCalledOnce();
    expect(player.commands.mixerStop).not.toHaveBeenCalled();
    expect(player.commands.mixerSeek).not.toHaveBeenCalled();
    expect(player.commands.engineRelease).not.toHaveBeenCalled();
    expect(player.sharedMetronome.release).not.toHaveBeenCalled();
    expect(getState().retime).toBe(retime);
    expect(getState().loop).toBe(loop);
    expect(player.commands.mixerSetRate.mock.calls).toEqual([
      [RETIME_PLAYBACK_RATE],
    ]);
  });

  it('still closes the song when the screen goes after being covered', async () => {
    const player = await openFirst();
    player.setFocused(false);
    player.setFocused(true);
    player.unmount();
    expect(player.store.getState().status).toBe('idle');
    expect(player.commands.mixerStop).toHaveBeenCalledOnce();
    expect(player.commands.engineRelease).toHaveBeenCalledOnce();
  });
});

describe('an Activity relaunch with the player focused', () => {
  it('stays open when the new surface mounts before the old one stops', async () => {
    const player = await openFirst();
    await openSurface(SET_ID);
    player.unmount();
    await act(flush);
    expect(player.store.getState().status).toBe('ready');
    expect(player.commands.engineRelease).not.toHaveBeenCalled();
    expect(player.records.readStemSet).toHaveBeenCalledTimes(2);
  });

  it('reopens when the old surface stops before the new one mounts', async () => {
    const player = await openFirst();
    player.unmount();
    await openSurface(SET_ID);
    expect(player.store.getState().status).toBe('ready');
    expect(player.records.readStemSet).toHaveBeenCalledTimes(2);
  });
});

describe('a load that does not reach ready', () => {
  it.each([
    ['missing', () => Promise.resolve(undefined)],
    ['failed', () => Promise.reject(new Error('locked'))],
  ] as const)('stays %s without retrying', async (status, read) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const player = await openFirst();
    await cover(player, 'acquire before blur');
    player.records.readStemSet.mockImplementationOnce(read);
    await uncover(player, 'release before refocus');
    expect(player.store.getState().status).toBe(status);
    expect(player.store.getState().setId).toBe(SET_ID);
    player.setFocused(false);
    player.setFocused(true);
    await act(flush);
    expect(player.store.getState().status).toBe(status);
    expect(player.records.readStemSet).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });
});

describe('something else closing the player', () => {
  it('stays closed through a refocus once the gate removed the screen', async () => {
    const fake = installFakeRuntime(FIRST_RECORD);
    surface = await mountSurface(<Gated on focused />);
    expect(stemPlayerStore.getState().status).toBe('ready');
    stemPlayerStore.getState().close();
    surface.update(<Gated on={false} focused />);
    surface.update(<Gated on={false} focused={false} />);
    surface.update(<Gated on={false} focused />);
    await act(flush);
    expect(stemPlayerStore.getState().status).toBe('idle');
    expect(fake.records.readStemSet).toHaveBeenCalledOnce();
    expect(fake.commands.engineRelease).toHaveBeenCalledOnce();
  });

  it('opens nothing for a screen mounted behind another', async () => {
    const player = await openFirst();
    player.unmount();
    surface = await mountSurface(playerTree({ focused: false }));
    expect(player.store.getState().status).toBe('idle');
    expect(player.records.readStemSet).toHaveBeenCalledOnce();
  });

  it('stays closed, with no reload, however often it is closed', async () => {
    const player = await openFirst();
    for (let close = 0; close < CLOSES; close++) {
      player.store.getState().close();
      await act(flush);
    }
    expect(player.store.getState().status).toBe('idle');
    expect(player.records.readStemSet).toHaveBeenCalledOnce();
  });
});
