// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { BPM_SOURCE_CREDIT, getGetSongBpmKeyStore } from '@kitbag/core-state';
import { act, createElement, type ReactNode } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GET_A_KEY_LABEL,
  GET_SONG_BPM_KEY_LABEL,
  KEY_NOT_SET,
  KEY_SET,
  REMOVE_KEY,
  SAVE_KEY,
  SAVED_KEY_LABEL,
} from './getSongBpmKeyText.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const opened = vi.hoisted(() => [] as string[]);

vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('./openUrl.ts', () => ({
  openUrl: (url: string) => {
    opened.push(url);
  },
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const host = (name: string) => (props: Props) => h(name, props);
  return {
    ...(await original<Record<string, unknown>>()),
    EditRow: host('EditRow'),
    EditValue: host('EditValue'),
    Button: host('Button'),
    SheetHint: host('SheetHint'),
    TextField: host('TextField'),
    Sheet: (props: Props) =>
      props.visible === true ? h('Sheet', null, props.children) : null,
    createThemedStyles: () => () => ({}),
  };
});

const { GetSongBpmKeyRow } = await import('./GetSongBpmKeyRow.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const TYPED_KEY = 'typed-key-0042';
const KEY_TAIL = '0042';
const KEY_MASK = '•';

let mounted: ReactTestRenderer | undefined;

function mount(): ReactTestInstance {
  act(() => {
    mounted = create(createElement(GetSongBpmKeyRow));
  });
  if (mounted === undefined) throw new Error('not mounted');
  return mounted.root;
}

function isHost(node: ReactTestInstance, name: string): boolean {
  return (node.type as unknown) === name;
}

function only(root: ReactTestInstance, name: string): ReactTestInstance {
  return root.find((node) => isHost(node, name));
}

function row(root: ReactTestInstance, label: string): ReactTestInstance {
  const [found] = root.findAll(
    (node) => isHost(node, 'EditRow') && node.props.label === label,
  );
  if (found === undefined) throw new Error(`no ${label} row`);
  return found;
}

function button(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.find(
    (node) => isHost(node, 'Button') && node.props.label === label,
  );
}

function value(root: ReactTestInstance, label: string): unknown {
  return only(row(root, label), 'EditValue').props.children;
}

function press(node: ReactTestInstance): void {
  act(() => {
    (node.props.onPress as () => void)();
  });
}

function type(root: ReactTestInstance, text: string): void {
  act(() => {
    (only(root, 'TextField').props.onChangeText as (t: string) => void)(text);
  });
}

function openSheet(): ReactTestInstance {
  const root = mount();
  press(row(root, GET_SONG_BPM_KEY_LABEL));
  return root;
}

afterEach(() => {
  act(() => {
    mounted?.unmount();
    getGetSongBpmKeyStore().getState().removeKey();
  });
  opened.length = 0;
});

describe('GetSongBPM key row', () => {
  it('reads Not set until a key is saved, then Set', () => {
    const root = mount();
    expect(value(root, GET_SONG_BPM_KEY_LABEL)).toBe(KEY_NOT_SET);
    act(() => {
      getGetSongBpmKeyStore().getState().setKey(TYPED_KEY);
    });
    expect(value(root, GET_SONG_BPM_KEY_LABEL)).toBe(KEY_SET);
  });

  it('stores the key typed into the sheet', () => {
    const root = openSheet();
    type(root, `  ${TYPED_KEY} `);
    press(button(root, SAVE_KEY));
    expect(getGetSongBpmKeyStore().getState().key).toBe(TYPED_KEY);
    expect(value(root, GET_SONG_BPM_KEY_LABEL)).toBe(KEY_SET);
  });

  it('keeps the keyboard from changing a typed key', () => {
    expect(only(openSheet(), 'TextField').props).toMatchObject({
      autoCapitalize: 'none',
      autoCorrect: false,
      spellCheck: false,
    });
  });

  it('offers no Save for a blank entry', () => {
    const root = openSheet();
    type(root, '   ');
    expect(button(root, SAVE_KEY).props.disabled).toBe(true);
  });

  it('says a key is saved without rendering any of its characters', () => {
    const root = openSheet();
    type(root, TYPED_KEY);
    press(button(root, SAVE_KEY));
    expect(value(root, SAVED_KEY_LABEL)).toBe(KEY_SET);
    const rendered = JSON.stringify(mounted?.toJSON());
    expect(rendered).not.toContain(KEY_TAIL);
    expect(rendered).not.toContain(KEY_MASK);
  });

  it('forgets the key when it is removed', () => {
    act(() => {
      getGetSongBpmKeyStore().getState().setKey(TYPED_KEY);
    });
    const root = openSheet();
    press(button(root, REMOVE_KEY));
    expect(getGetSongBpmKeyStore().getState().key).toBe('');
    expect(value(root, GET_SONG_BPM_KEY_LABEL)).toBe(KEY_NOT_SET);
  });

  it('links to getsongbpm.com from the sheet', () => {
    press(row(openSheet(), GET_A_KEY_LABEL));
    expect(opened).toEqual([BPM_SOURCE_CREDIT.getsongbpm.url]);
  });
});
