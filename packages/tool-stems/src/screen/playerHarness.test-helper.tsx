// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { SheetHost, ThemeProvider } from '@kitbag/core-design';
import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import { configureStemPlayer, stemPlayerStore } from '@kitbag/core-state';
import {
  at,
  fakeRuntime,
  record,
  stem,
  SONG_DETAILS,
} from '@kitbag/core-state/src/stemPlayer/store.test-helper.ts';
import { act, Profiler } from 'react';
import { create, type ReactTestInstance } from 'react-test-renderer';
import { vi } from 'vitest';

import { runFrame } from '../testing/reanimatedDriver.ts';
import { StemPlayerScreen } from './StemPlayerScreen.tsx';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export { at, SONG_DETAILS };

export const INSETS = { top: 0, bottom: 0 };
export const PLAIN_LYRICS = {
  synced: null,
  plain: 'First line\nSecond line\n\nThird line',
  offsetSec: 0,
  instrumental: false,
};
export const INSTRUMENTAL = {
  synced: null,
  plain: null,
  offsetSec: 0,
  instrumental: true,
};

type RecordChange = NonNullable<Parameters<typeof record>[1]>;
type FakeRuntime = ReturnType<typeof fakeRuntime>['runtime'];

// configureStemPlayer takes one runtime for the process, so it delegates.
let live: FakeRuntime | undefined;
const delegating = new Proxy({} as FakeRuntime, {
  get: (_, key: keyof FakeRuntime) => live?.[key],
});
configureStemPlayer(delegating);

export async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map(textOf).join('');
}

export function setHost(seconds: number, playing = 1): void {
  (globalThis as unknown as Record<string, unknown>)[KITBAG_HOST_OBJECT_KEY] = {
    mixer_position: at(seconds),
    mixer_playing: playing,
  };
}

export async function mountPlayer(change: RecordChange = SONG_DETAILS) {
  const fake = fakeRuntime(record([stem(1), stem(2)], change));
  live = fake.runtime;
  const commit = vi.fn();
  const scrolls = vi.fn();
  const onBack = vi.fn();
  const renderer = create(<></>, {
    createNodeMock: () => ({ scrollTo: scrolls }),
  });
  await act(async () => {
    renderer.update(
      <ThemeProvider mode="dark">
        <SheetHost topInset={0}>
          <Profiler id="player" onRender={commit}>
            <StemPlayerScreen setId={7} insets={INSETS} onBack={onBack} />
          </Profiler>
        </SheetHost>
      </ThemeProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  fake.commands.mixerSeek.mockClear();
  fake.commands.mixerClearLoop.mockClear();
  const hosts = () =>
    renderer.root.findAll((node) => typeof node.type === 'string');
  const isText = (node: ReactTestInstance) => String(node.type) === 'Text';
  const labelled = (label: string) =>
    hosts().filter((node) => node.props.accessibilityLabel === label);
  const byLabel = (label: string): ReactTestInstance => {
    const [found] = labelled(label);
    if (found === undefined) throw new Error(`no control labelled "${label}"`);
    return found;
  };
  const texts = () => hosts().filter(isText).map(textOf);
  const fire = async (label: string, handler: string) => {
    await act(async () => {
      (byLabel(label).props[handler] as () => unknown)();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  return {
    ...fake,
    renderer,
    commit,
    scrolls,
    onBack,
    labelled,
    byLabel,
    texts,
    has: (text: string) => texts().includes(text),
    textNode: (text: string) =>
      hosts().find((node) => isText(node) && textOf(node) === text),
    press: (label: string) => fire(label, 'onPress'),
    hold: (label: string) => fire(label, 'onLongPress'),
    touchDown: (label: string) => fire(label, 'onPressIn'),
    frames: (seconds: number, count = 1) => {
      setHost(seconds);
      act(() => {
        for (let i = 0; i < count; i++) runFrame();
      });
    },
    unmount: () => {
      act(() => {
        renderer.unmount();
      });
    },
    store: stemPlayerStore,
  };
}

export type Player = Awaited<ReturnType<typeof mountPlayer>>;
