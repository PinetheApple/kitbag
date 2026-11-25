// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { QUEUE_TEXT, SheetHost, ThemeProvider } from '@kitbag/core-design';
import {
  ARRIVAL,
  arrivalStore,
  stemPlayerStore,
  stemViewStore,
  VIEW_ONLY_REASON,
  type MixerHold,
} from '@kitbag/core-state';
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

const VIEWED = SET_ID + 1;
const VIEWED_TITLE = 'Way Maker';
const DOCKED = 'docked mini-player';
const MENU = 'Player menu';
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

async function playingThenViewed() {
  stemPlayerStore.getState().close();
  const fake = installFakeRuntime();
  const stored = await fake.records.readStemSet();
  if (stored === undefined) throw new Error('no record');
  const viewed = {
    ...stored,
    id: VIEWED,
    title: VIEWED_TITLE,
    songTitle: null,
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
