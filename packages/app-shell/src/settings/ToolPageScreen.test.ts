// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import type { ToolData } from '@kitbag/core-db';
import {
  KB_TOOL_DOWNLOADS,
  KB_TOOL_INSTALL_STAGE,
  KB_TOOL_REJECTION,
  type NativeToolInstaller,
  type ToolCatalogue,
  type ToolCatalogueTool,
  type ToolInstallUpdate,
} from '@kitbag/core-native';
import { configureToolInstall, getToolInstallStore } from '@kitbag/core-state';
import { act, createElement, type ReactNode } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ALSO_DELETE_DATA,
  CANCEL,
  CHECKING,
  DELETE_DATA,
  DOWNLOADING,
  REMOVE,
  REMOVE_AND_DELETE,
  TRY_AGAIN,
} from './toolPageText.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', () => ({ View: 'View', Text: 'Text' }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('./SettingsFrame.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    SettingsFrame: (props: Props) =>
      h('SettingsFrame', null, props.children, props.overlay as ReactNode),
  };
});
vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const host = (name: string) => (props: Props) => h(name, props);
  return {
    ...(await original<Record<string, unknown>>()),
    Badge: host('Badge'),
    Button: host('Button'),
    Card: host('Card'),
    EditCheckRow: host('EditCheckRow'),
    EditGroup: host('EditGroup'),
    EditRow: host('EditRow'),
    EditSwitchRow: host('EditSwitchRow'),
    EditValue: host('EditValue'),
    Icon: host('Icon'),
    LinearProgress: host('LinearProgress'),
    RowIcon: host('RowIcon'),
    SectionHeader: host('SectionHeader'),
    Sheet: (props: Props) =>
      props.visible === true ? h('Sheet', props, props.children) : null,
    createThemedStyles: () => () => ({}),
    useTheme: () => ({ accentInk: 'accent' }),
  };
});

const { ToolPageScreen } = await import('./ToolPageScreen.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const ID = 'recorder';
const TOTAL = 1_600_000;
const STAGE = KB_TOOL_INSTALL_STAGE;

const TOOL: ToolCatalogueTool = {
  toolId: ID,
  name: 'Practice recorder',
  icon: 'mic',
  summary: 'Record yourself playing with the click.',
  version: '0.9.0',
  sizeBytes: TOTAL,
  capabilities: [],
  installedVersion: null,
  installedManifestSha256: null,
  installedBytes: 0,
  installedProblem: null,
  highWaterVersion: null,
};
const INSTALLED: ToolCatalogueTool = {
  ...TOOL,
  installedVersion: '0.9.0',
  installedBytes: 4_100_000,
};

function catalogue(tool: ToolCatalogueTool): ToolCatalogue {
  return {
    hostVersionName: '0.31.0',
    indexProblem: null,
    highWaterProblem: null,
    tools: [tool],
  };
}

let listener: ((update: ToolInstallUpdate) => void) | undefined;
const list = vi.fn<ToolData['list']>();
const clear = vi.fn<ToolData['clear']>();
const native = {
  downloads: vi.fn<NativeToolInstaller['downloads']>(),
  setDownloads: vi.fn<NativeToolInstaller['setDownloads']>(),
  catalogue: vi.fn<NativeToolInstaller['catalogue']>(),
  install: vi.fn<NativeToolInstaller['install']>(),
  cancel: vi.fn<NativeToolInstaller['cancel']>(),
  remove: vi.fn<NativeToolInstaller['remove']>(),
  onUpdate: (next: (update: ToolInstallUpdate) => void) => {
    listener = next;
    return () => undefined;
  },
} satisfies NativeToolInstaller;

configureToolInstall({
  native,
  toolData: { forTool: () => ({ list, clear }) as unknown as ToolData },
});

const onOptIn = vi.fn<(toolId: string) => void>();
const onRemoved = vi.fn<(toolId: string) => void>();
let mounted: ReactTestRenderer | undefined;

function emit(
  stage: ToolInstallUpdate['stage'],
  fields: Partial<ToolInstallUpdate> = {},
) {
  act(() => {
    listener?.({
      toolId: ID,
      stage,
      receivedBytes: 0,
      totalBytes: TOTAL,
      attempt: 1,
      failure: null,
      detail: null,
      neededBytes: 0,
      freeBytes: 0,
      ...fields,
    });
  });
}

async function mount(tool: ToolCatalogueTool): Promise<ReactTestInstance> {
  native.catalogue.mockResolvedValue(catalogue(tool));
  await act(async () => {
    mounted = create(
      createElement(ToolPageScreen, {
        toolId: ID,
        onBack: () => undefined,
        onOptIn,
        onRemoved,
      }),
    );
    await Promise.resolve();
  });
  if (mounted === undefined) throw new Error('not mounted');
  return mounted.root;
}

function isHost(node: ReactTestInstance, name: string): boolean {
  return (node.type as unknown) === name;
}

function button(root: ReactTestInstance, label: string): ReactTestInstance {
  return root.find(
    (node) =>
      isHost(node, 'Button') &&
      typeof node.props.label === 'string' &&
      node.props.label.startsWith(label),
  );
}

function hasButton(root: ReactTestInstance, label: string): boolean {
  return (
    root.findAll((node) => isHost(node, 'Button') && node.props.label === label)
      .length > 0
  );
}

async function press(node: ReactTestInstance): Promise<void> {
  await act(async () => {
    (node.props.onPress as () => void)();
    await Promise.resolve();
  });
}

function rendered(): string {
  return JSON.stringify(mounted?.toJSON());
}

beforeEach(() => {
  vi.clearAllMocks();
  native.downloads.mockResolvedValue(KB_TOOL_DOWNLOADS.on);
  native.setDownloads.mockResolvedValue(undefined);
  native.install.mockResolvedValue(true);
  native.remove.mockResolvedValue(undefined);
  list.mockResolvedValue([]);
  clear.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => {
    mounted?.unmount();
  });
  getToolInstallStore().setState({ jobs: {}, catalogue: null, data: {} });
});

describe('installing from the tool page', () => {
  it('opens the opt-in instead of installing while downloads were never asked', async () => {
    native.downloads.mockResolvedValue(KB_TOOL_DOWNLOADS.unasked);
    const root = await mount(TOOL);
    await press(button(root, 'Install'));
    expect(native.install).not.toHaveBeenCalled();
    expect(onOptIn).toHaveBeenCalledExactlyOnceWith(ID);
  });

  it('shows the download, the check, then a failed check with Try again', async () => {
    const root = await mount(TOOL);
    await press(button(root, 'Install'));
    expect(native.install).toHaveBeenCalledExactlyOnceWith(ID, false);

    emit(STAGE.downloading, { receivedBytes: 900_000 });
    expect(rendered()).toContain(DOWNLOADING);
    expect(rendered()).toContain('0.9 of 1.6 MB');

    emit(STAGE.checking);
    expect(rendered()).toContain(CHECKING);
    expect(root.findByType('LinearProgress' as never).props.percent).toBeNull();

    emit(STAGE.failed, { failure: KB_TOOL_REJECTION.signature });
    expect(rendered()).toContain('Not installed: the check failed');
    expect(hasButton(root, TRY_AGAIN)).toBe(true);
  });

  it('cancels a running download through native', async () => {
    const root = await mount(TOOL);
    await press(button(root, 'Install'));
    emit(STAGE.downloading, { receivedBytes: 1 });
    await press(button(root, CANCEL));
    expect(native.cancel).toHaveBeenCalledExactlyOnceWith(ID);
  });
});

describe('removing from the tool page', () => {
  it('removes the tool and keeps its data by default', async () => {
    list.mockResolvedValue([
      { key: 'take', value: '1', updatedAt: new Date(0) },
    ]);
    const root = await mount(INSTALLED);
    await press(button(root, REMOVE));
    await press(
      root
        .find((n) => isHost(n, 'Sheet'))
        .find((n) => isHost(n, 'Button') && n.props.label === REMOVE),
    );
    expect(native.remove).toHaveBeenCalledExactlyOnceWith(ID);
    expect(clear).not.toHaveBeenCalled();
    expect(onRemoved).toHaveBeenCalledExactlyOnceWith(ID);
  });

  it('deletes the data after removing when the box is ticked', async () => {
    list.mockResolvedValue([
      { key: 'take', value: '1', updatedAt: new Date(0) },
    ]);
    const root = await mount(INSTALLED);
    await press(button(root, REMOVE));
    await act(async () => {
      (
        root.find((n) => isHost(n, 'EditCheckRow')).props.onToggle as () => void
      )();
      await Promise.resolve();
    });
    expect(root.find((n) => isHost(n, 'EditCheckRow')).props.label).toBe(
      ALSO_DELETE_DATA,
    );
    await press(button(root, REMOVE_AND_DELETE));
    expect(native.remove.mock.invocationCallOrder[0]).toBeLessThan(
      clear.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('deletes the data a removed tool left without installing it', async () => {
    list.mockResolvedValue([
      { key: 'take', value: '1', updatedAt: new Date(0) },
    ]);
    const root = await mount(TOOL);
    await press(button(root, DELETE_DATA));
    expect(clear).toHaveBeenCalledOnce();
    expect(native.remove).not.toHaveBeenCalled();
    expect(native.install).not.toHaveBeenCalled();
  });
});
