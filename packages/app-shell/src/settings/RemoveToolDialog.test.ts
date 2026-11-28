// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import type { ToolDataUsage } from '@kitbag/core-state';
import { act, createElement, type ReactNode } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ALSO_DELETE_DATA,
  CANCEL,
  DELETED_FOREVER,
  REMOVE,
  REMOVE_AND_DELETE,
  removeBody,
} from './toolPageText.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', () => ({ View: 'View', Text: 'Text' }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const host = (name: string) => (props: Props) => h(name, props);
  return {
    ...(await original<Record<string, unknown>>()),
    Button: host('Button'),
    EditCheckRow: host('EditCheckRow'),
    EditGroup: host('EditGroup'),
    EditValue: host('EditValue'),
    Sheet: (props: Props) =>
      props.visible === true ? h('Sheet', props, props.children) : null,
    createThemedStyles: () => () => ({}),
  };
});

const { RemoveToolDialog } = await import('./RemoveToolDialog.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const KEPT: ToolDataUsage = { bytes: 38_000_000, items: 12 };
const onConfirm = vi.fn<(deleteData: boolean) => void>();
const onCancel = vi.fn<() => void>();
let mounted: ReactTestRenderer | undefined;

function mount(data: ToolDataUsage): ReactTestInstance {
  act(() => {
    mounted = create(
      createElement(RemoveToolDialog, {
        visible: true,
        name: 'Practice recorder',
        data,
        onConfirm,
        onCancel,
      }),
    );
  });
  if (mounted === undefined) throw new Error('not mounted');
  return mounted.root;
}

function isHost(node: ReactTestInstance, name: string): boolean {
  return (node.type as unknown) === name;
}

function button(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.find((n) => isHost(n, 'Button') && n.props.label === label);
}

function rendered(): string {
  return JSON.stringify(mounted?.toJSON());
}

function tick(root: ReactTestInstance): void {
  act(() => {
    (
      root.find((n) => isHost(n, 'EditCheckRow')).props.onToggle as () => void
    )();
  });
}

afterEach(() => {
  act(() => {
    mounted?.unmount();
  });
  vi.clearAllMocks();
});

describe('remove dialog', () => {
  it('keeps the data unless the box is ticked (6b)', () => {
    const root = mount(KEPT);
    expect(root.find((n) => isHost(n, 'EditCheckRow')).props).toMatchObject({
      label: ALSO_DELETE_DATA,
      checked: false,
    });
    expect(rendered()).toContain(removeBody(KEPT.items, false));
    expect(rendered()).not.toContain(DELETED_FOREVER);
    act(() => {
      (button(root, REMOVE).props.onPress as () => void)();
    });
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('changes the text, the button and warns once the box is ticked (6c)', () => {
    const root = mount(KEPT);
    tick(root);
    expect(rendered()).toContain(removeBody(KEPT.items, true));
    expect(rendered()).toContain(DELETED_FOREVER);
    act(() => {
      (button(root, REMOVE_AND_DELETE).props.onPress as () => void)();
    });
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('offers no data box for a tool with no data', () => {
    const root = mount({ bytes: 0, items: 0 });
    expect(root.findAll((n) => isHost(n, 'EditCheckRow'))).toHaveLength(0);
  });

  it('cancels without removing', () => {
    const root = mount(KEPT);
    act(() => {
      (button(root, CANCEL).props.onPress as () => void)();
    });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
