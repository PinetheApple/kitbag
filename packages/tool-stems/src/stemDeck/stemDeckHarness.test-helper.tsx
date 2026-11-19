// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { SheetHost, ThemeProvider } from '@kitbag/core-design';
import {
  configureStemDeck,
  stemDeckStore,
  type StemDeckCatalog,
  type StemDeckImportRow,
  type StemDeckRuntime,
} from '@kitbag/core-state';
import {
  fakeCamera,
  fakeNative,
} from '@kitbag/core-state/src/stemDeck/store.test-helper.ts';
import { act, type ReactElement } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, vi } from 'vitest';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export const ORIGIN = 'https://192.168.1.50:8443';
export const SONG_A = 'a'.repeat(12);
export const SONG_B = 'b'.repeat(12);
export const SONG_OWNED = 'c'.repeat(12);

export const CATALOG: StemDeckCatalog = {
  songs: [
    {
      jobId: SONG_OWNED,
      title: 'Echo (In Jesus Name) [LIVE]',
      artist: 'Charity Gayle',
      durationSec: 311,
      lanes: ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'],
      inLibrary: true,
    },
    {
      jobId: SONG_A,
      title: 'Way Maker',
      artist: 'Sinach',
      durationSec: 481,
      lanes: ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'],
      inLibrary: false,
    },
    {
      jobId: SONG_B,
      title: 'Gratitude',
      artist: 'Brandon Lake',
      durationSec: 352,
      lanes: ['vocals', 'drums', 'bass'],
      inLibrary: false,
    },
  ],
  setlists: [{ id: 's1', name: 'Sunday worship', songIds: [SONG_B] }],
  unavailable: 2,
};

const fakes = { native: fakeNative().native, camera: fakeCamera() };

export function live() {
  return fakes;
}

const runtime: StemDeckRuntime = {
  get native() {
    return fakes.native;
  },
  get camera() {
    return fakes.camera;
  },
  unityNotice: { load: () => false, save: () => undefined },
};
configureStemDeck(runtime);

const pristine = stemDeckStore.getState();

export function resetStemDeck(answer: 'granted' | 'denied' = 'granted') {
  fakes.native = fakeNative().native;
  fakes.camera = fakeCamera(answer);
  stemDeckStore.setState(pristine, true);
  return fakes;
}

export function connected(catalog: StemDeckCatalog = CATALOG) {
  stemDeckStore.setState({
    connection: { status: 'connected', origin: ORIGIN, version: '2.4.0' },
    catalog,
  });
}

export function importRow(
  title: string,
  phase: StemDeckImportRow['phase'],
  change: Partial<StemDeckImportRow> = {},
): StemDeckImportRow {
  return {
    jobId: title,
    title,
    phase,
    failure: null,
    refusal: null,
    percent: null,
    bytesDone: 0,
    bytesTotal: null,
    bytesFree: null,
    ...change,
  };
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map(textOf).join('');
}

let mounted: ReactTestRenderer | undefined;

afterEach(() => {
  if (mounted !== undefined) {
    const done = mounted;
    act(() => {
      done.unmount();
    });
  }
  mounted = undefined;
  vi.restoreAllMocks();
});

export async function mount(element: ReactElement) {
  const focus = vi.fn();
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(
      <ThemeProvider mode="dark">
        <SheetHost topInset={0}>{element}</SheetHost>
      </ThemeProvider>,
      {
        createNodeMock: (node) => (node.type === 'TextInput' ? { focus } : {}),
      },
    );
    await tick();
  });
  if (renderer === undefined) throw new Error('screen did not mount');
  mounted = renderer;
  const root = renderer;
  const hosts = () =>
    root.root.findAll((node) => typeof node.type === 'string');
  const texts = () =>
    hosts()
      .filter((node) => String(node.type) === 'Text')
      .map(textOf);
  const labelled = (label: string) =>
    hosts().filter((node) => node.props.accessibilityLabel === label);
  const byLabel = (label: string): ReactTestInstance => {
    const [found] = labelled(label);
    if (found === undefined) throw new Error(`no control labelled "${label}"`);
    return found;
  };
  const pressableWithText = (text: string): ReactTestInstance => {
    const node = hosts().find(
      (host) => String(host.type) === 'Text' && textOf(host) === text,
    );
    for (let at = node ?? null; at !== null; at = at.parent)
      if (typeof at.props.onPress === 'function') return at;
    throw new Error(`nothing pressable shows "${text}"`);
  };
  const fire = async (node: ReactTestInstance) => {
    await act(async () => {
      (node.props.onPress as () => unknown)();
      await tick();
    });
  };
  return {
    focus,
    texts,
    has: (text: string) => texts().includes(text),
    hosts,
    labelled,
    byLabel,
    press: (label: string) => fire(byLabel(label)),
    tap: (text: string) => fire(pressableWithText(text)),
    settle: () => act(tick),
  };
}
