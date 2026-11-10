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
import {
  act,
  Profiler,
  type ProfilerOnRenderCallback,
  type ReactElement,
} from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, vi } from 'vitest';

import { takeAccessibilityEvents } from '../testing/reactNativeHosts.ts';
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

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function flush(): Promise<void> {
  await act(tick);
}

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map(textOf).join('');
}

export function withTestId(
  { renderer }: { readonly renderer: ReactTestRenderer },
  testID: string,
): ReactTestInstance[] {
  return renderer.root.findAll(
    (node) => typeof node.type === 'string' && node.props.testID === testID,
  );
}

export function fireLayout(
  node: ReactTestInstance | undefined,
  layout: object,
): void {
  act(() => {
    (node?.props.onLayout as (e: unknown) => void)({
      nativeEvent: { layout },
    });
  });
}

export interface ReaderHiding {
  readonly android: boolean;
  readonly ios: boolean;
}

export const HIDDEN_FROM_READERS: ReaderHiding = { android: true, ios: true };
export const SHOWN_TO_READERS: ReaderHiding = { android: false, ios: false };

function readerHiding(node: ReactTestInstance): ReaderHiding {
  const hosts: ReactTestInstance[] = [];
  for (
    let step: ReactTestInstance | null = node;
    step !== null;
    step = step.parent
  )
    if (typeof step.type === 'string') hosts.push(step);
  return {
    android: hosts.some(
      (host) => host.props.importantForAccessibility === 'no-hide-descendants',
    ),
    ios: hosts.some((host) => host.props.accessibilityElementsHidden === true),
  };
}

interface NodeMock {
  readonly element: ReactElement<{ readonly children?: unknown }>;
}

function readerFocus(): unknown[] {
  return takeAccessibilityEvents()
    .filter((event) => event.type === 'focus')
    .map((event) => (event.handle as NodeMock).element.props.children);
}

export function setHost(seconds: number, playing = 1): void {
  (globalThis as unknown as Record<string, unknown>)[KITBAG_HOST_OBJECT_KEY] = {
    mixer_position: at(seconds),
    mixer_playing: playing,
  };
}

const noRenderProbe: ProfilerOnRenderCallback = () => undefined;
const noBack = () => undefined;

export const SET_ID = 7;
export const STEMS = [stem(1), stem(2)];

interface PlayerTreeProps {
  readonly setId?: number;
  readonly focused?: boolean;
  readonly onBack?: () => void;
  readonly onRender?: ProfilerOnRenderCallback;
}

export function playerTree({
  setId = SET_ID,
  focused = true,
  onBack = noBack,
  onRender = noRenderProbe,
}: PlayerTreeProps = {}) {
  return (
    <ThemeProvider mode="dark">
      <SheetHost topInset={0}>
        <Profiler id="player" onRender={onRender}>
          <StemPlayerScreen
            setId={setId}
            focused={focused}
            insets={INSETS}
            onBack={onBack}
          />
        </Profiler>
      </SheetHost>
    </ThemeProvider>
  );
}

export function installFakeRuntime(change: RecordChange = SONG_DETAILS) {
  const fake = fakeRuntime(record(STEMS, change));
  live = fake.runtime;
  return fake;
}

export function textsOf(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAll((node) => String(node.type) === 'Text')
    .map(textOf);
}

export async function mountSurface(element: ReactElement) {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(element);
    await tick();
  });
  if (renderer === undefined) throw new Error('surface did not mount');
  const mounted = renderer;
  return {
    has: (text: string) => textsOf(mounted).includes(text),
    update: (next: ReactElement) => {
      act(() => {
        mounted.update(next);
      });
    },
    unmount: () => {
      act(() => {
        mounted.unmount();
      });
    },
  };
}

export async function mountPlayer(change: RecordChange = SONG_DETAILS) {
  const fake = installFakeRuntime(change);
  takeAccessibilityEvents();
  const commit = vi.fn();
  const scrolls = vi.fn();
  const onBack = vi.fn();
  const renderer = create(<></>, {
    createNodeMock: (element) => ({ scrollTo: scrolls, element }),
  });
  const tree = (focused: boolean) =>
    playerTree({ focused, onBack, onRender: commit });
  await act(async () => {
    renderer.update(tree(true));
    await tick();
  });
  fake.commands.mixerSeek.mockClear();
  fake.commands.mixerClearLoop.mockClear();
  fake.commands.mixerStop.mockClear();
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
  const textNode = (text: string) =>
    hosts().find((node) => isText(node) && textOf(node) === text);
  const byText = (text: string): ReactTestInstance => {
    const found = textNode(text);
    if (found === undefined) throw new Error(`no text "${text}"`);
    return found;
  };
  const fire = async (label: string, handler: string) => {
    await act(async () => {
      (byLabel(label).props[handler] as () => unknown)();
      await tick();
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
    byText,
    texts,
    has: (text: string) => texts().includes(text),
    textNode,
    readerFocus,
    readerHiding: (label: string) => readerHiding(byLabel(label)),
    textReaderHiding: (text: string) => readerHiding(byText(text)),
    press: (label: string) => fire(label, 'onPress'),
    hold: (label: string) => fire(label, 'onLongPress'),
    touchDown: (label: string) => fire(label, 'onPressIn'),
    frames: (seconds: number, count = 1) => {
      setHost(seconds);
      act(() => {
        for (let i = 0; i < count; i++) runFrame();
      });
    },
    setFocused: (focused: boolean) => {
      act(() => {
        renderer.update(tree(focused));
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

export const RETIME = 'Retime lyrics';
export const PAD = 'Tap as this line starts';
export const UNDO_TAP = 'Undo tap';
export const LATER = 'Shift all lines later';
export const RESET = 'Reset to bundle timing';
export const CLOSE = 'Close retime';
export const SAVE = 'Save';
export const NOT_SAVED =
  'Timing not saved. Your taps are still here, try again.';
export const DIALOG_TITLE = 'Reset to bundle timing?';
export const RETIME_CONTROLS = [PAD, UNDO_TAP, LATER, RESET, SAVE, CLOSE];

let tracked: Player | undefined;

afterEach(() => {
  tracked?.unmount();
  tracked = undefined;
});

export async function mountTracked(
  change: RecordChange = SONG_DETAILS,
): Promise<Player> {
  tracked = await mountPlayer(change);
  return tracked;
}

export function unmountTracked(): void {
  tracked?.unmount();
  tracked = undefined;
}

export async function retiming(
  change: RecordChange = SONG_DETAILS,
): Promise<Player> {
  const p = await mountTracked(change);
  await p.press('Lyrics');
  await p.press(RETIME);
  return p;
}

export function holdSave(p: Player): (reason: Error) => void {
  let refuse: (reason: Error) => void = () => undefined;
  p.records.saveLyricsRetimed.mockReturnValueOnce(
    new Promise((_, reject) => {
      refuse = reject;
    }),
  );
  return refuse;
}
