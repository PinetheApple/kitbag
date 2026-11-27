// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  opacity,
  QUEUE_TEXT,
  SET_TEMPO_COPY,
  SheetHost,
  ThemeProvider,
} from '@kitbag/core-design';
import {
  ARRIVAL,
  arrivalStore,
  stemPlayerStore,
  stemViewStore,
  VIEW_ONLY_REASON,
  type MixerHold,
} from '@kitbag/core-state';
import { KB_RESULT } from '@kitbag/core-native';
import { act, type ReactElement } from 'react';
import { Text } from 'react-native';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  flush,
  INSETS,
  installFakeRuntime,
  SET_ID,
} from './playerHarness.test-helper.tsx';
import { StemPlayerScreen } from './StemPlayerScreen.tsx';
import { WAVEFORM_BARS } from './StemRowView.tsx';
import { NO_GRID_REASON } from '../logic/meterEdit.ts';

const VIEWED = SET_ID + 1;
const VIEWED_TITLE = 'Way Maker';
const DOCKED = 'docked mini-player';
const MENU = 'Player menu';
const STEMS_MISSING = 'No stem files could be opened. Nothing will play.';
const MASTER = 'Master volume, 0 dB, expand';

const routes = {
  onBack: vi.fn(),
  onOpenStemSet: vi.fn(),
  onOpenSong: vi.fn(),
  onOpenMetronome: vi.fn(),
  onOpenSetlist: vi.fn(),
};

const renderMiniPlayer = () => <Text>{DOCKED}</Text>;

function viewedScreen(view = true): ReactElement {
  return (
    <ThemeProvider mode="dark">
      <SheetHost topInset={0}>
        <StemPlayerScreen
          setId={VIEWED}
          view={view}
          focused
          insets={INSETS}
          renderMiniPlayer={renderMiniPlayer}
          {...routes}
        />
      </SheetHost>
    </ThemeProvider>
  );
}

let renderer: ReactTestRenderer | undefined;
let hold: MixerHold | undefined;

async function playingThenViewed(beats?: readonly number[]) {
  stemPlayerStore.getState().close();
  const fake = installFakeRuntime();
  const stored = await fake.records.readStemSet();
  if (stored === undefined) throw new Error('no record');
  const viewed = {
    ...stored,
    id: VIEWED,
    title: VIEWED_TITLE,
    songTitle: null,
    ...(beats === undefined ? {} : { beats, downbeatIndices: [] }),
  };
  fake.records.readStemSet.mockImplementation(((id: number) =>
    Promise.resolve(id === VIEWED ? viewed : stored)) as never);
  hold = stemPlayerStore.getState().acquireSong(SET_ID, WAVEFORM_BARS);
  await flush();
  fake.commands.mixerStop.mockClear();
  fake.commands.loadTrack.mockClear();
  await act(async () => {
    renderer = create(viewedScreen());
    await flush();
  });
  return { fake, playing: stemPlayerStore.getState().title };
}

function hosts(): ReactTestInstance[] {
  return renderer?.root.findAll((node) => typeof node.type === 'string') ?? [];
}

const labelled = (label: string) =>
  hosts().filter((node) => node.props.accessibilityLabel === label);

function byLabel(label: string): ReactTestInstance {
  const [found] = labelled(label);
  if (found === undefined) throw new Error(`no control labelled "${label}"`);
  return found;
}

const texts = () =>
  hosts()
    .filter((node) => String(node.type) === 'Text')
    .flatMap((node) => node.children.filter((c) => typeof c === 'string'));

async function press(label: string) {
  await act(async () => {
    (byLabel(label).props.onPress as () => unknown)();
    await flush();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = undefined;
  hold?.release();
  hold = undefined;
});

describe('a stem song viewed while another plays', () => {
  it('leaves the playing song loaded and the engine alone', async () => {
    const { fake } = await playingThenViewed();
    expect(stemPlayerStore.getState()).toMatchObject({
      status: 'ready',
      setId: SET_ID,
    });
    expect(stemViewStore.getState()).toMatchObject({
      status: 'ready',
      setId: VIEWED,
    });
    expect(fake.commands.mixerStop).not.toHaveBeenCalled();
    expect(fake.commands.loadTrack).not.toHaveBeenCalled();
  });

  it('hides Up next and names both songs on Play', async () => {
    const { playing } = await playingThenViewed();
    expect(labelled(QUEUE_TEXT.previous)).toEqual([]);
    expect(labelled(`Play ${VIEWED_TITLE}. Stops ${playing}.`)).not.toEqual([]);
  });

  it('docks the mini-player under the transport', async () => {
    await playingThenViewed();
    expect(texts()).toContain(DOCKED);
  });

  it('disables the master level and Export mix until Play', async () => {
    await playingThenViewed();
    expect(byLabel(MASTER).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await press(MENU);
    expect(
      byLabel(`Export mix: ${VIEW_ONLY_REASON}`).props.accessibilityState,
    ).toEqual({ disabled: true });
  });

  it('offers Set tempo on a viewed song with no grid only as a faded, disabled button', async () => {
    await playingThenViewed([]);
    const button = byLabel(SET_TEMPO_COPY.title);
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    const faded = [button, ...button.findAll(() => true)].some((node) => {
      const raw: unknown = node.props.style;
      const style = Object.assign(
        {},
        ...([raw].flat(Infinity) as object[]),
      ) as { opacity?: number };
      return style.opacity === opacity.muted;
    });
    expect(faded).toBe(true);
  });

  it('disables the Set tempo row with the view reason and never opens the sheet', async () => {
    await playingThenViewed([]);
    await press(MENU);
    const row = byLabel(`${SET_TEMPO_COPY.title}, ${VIEW_ONLY_REASON}`);
    expect(row.props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => {
      (row.props.onPress as () => unknown)();
      await flush();
    });
    expect(texts()).not.toContain(SET_TEMPO_COPY.stepOne);
    expect(labelled(SET_TEMPO_COPY.close)).toEqual([]);
  });

  it('keeps the no-grid reason on Meter over the view reason', async () => {
    await playingThenViewed([]);
    await press(MENU);
    expect(
      byLabel(`Meter, ${NO_GRID_REASON}`).props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it('does not follow the playing song to its next one', async () => {
    await playingThenViewed();
    act(() => {
      arrivalStore.setState({
        arrival: {
          kind: ARRIVAL.arriving,
          song: { kind: 'stems', id: VIEWED + 1 },
          serial: Date.now(),
        },
      });
    });
    expect(routes.onOpenStemSet).not.toHaveBeenCalled();
    expect(routes.onOpenSong).not.toHaveBeenCalled();
  });

  it('shows no missing-stems error before Play', async () => {
    await playingThenViewed();
    expect(texts()).not.toContain(STEMS_MISSING);
  });

  it('draws its stem rows at full strength before Play', async () => {
    await playingThenViewed();
    const names = stemViewStore.getState().stems.map((row) => row.name);
    const greyed = hosts().filter((node) => {
      const style = Object.assign(
        {},
        ...([node.props.style].flat(Infinity) as object[]),
      ) as { opacity?: number };
      return style.opacity === opacity.muted;
    });
    const greyedNames = greyed.flatMap((node) =>
      node
        .findAll((child) => String(child.type) === 'Text')
        .flatMap((text) => text.children)
        .filter((child) => typeof child === 'string' && names.includes(child)),
    );
    expect(names).not.toEqual([]);
    expect(greyedNames).toEqual([]);
  });

  it('shows the missing-stems error once Play cannot open them', async () => {
    const { fake, playing } = await playingThenViewed();
    fake.commands.loadTrack.mockResolvedValue(KB_RESULT.KB_ERROR_INTERNAL);
    await press(`Play ${VIEWED_TITLE}. Stops ${playing}.`);
    expect(texts()).toContain(STEMS_MISSING);
  });

  it('switches to the viewed song on Play and becomes its player', async () => {
    const { playing } = await playingThenViewed();
    await press(`Play ${VIEWED_TITLE}. Stops ${playing}.`);
    expect(stemPlayerStore.getState()).toMatchObject({
      status: 'ready',
      setId: VIEWED,
    });
    expect(stemViewStore.getState().status).toBe('idle');
    expect(labelled(QUEUE_TEXT.previous)).not.toEqual([]);
    expect(texts()).not.toContain(DOCKED);
  });

  it('opens sheets on the live song once Play has switched', async () => {
    const { playing } = await playingThenViewed();
    await press(`Play ${VIEWED_TITLE}. Stops ${playing}.`);
    await press(MENU);
    expect(labelled('Export mix as a WAV file')).not.toEqual([]);
  });

  it('stops viewing when the screen goes', async () => {
    await playingThenViewed();
    act(() => {
      renderer?.unmount();
    });
    renderer = undefined;
    expect(stemViewStore.getState().status).toBe('idle');
    expect(stemPlayerStore.getState().setId).toBe(SET_ID);
  });
});
