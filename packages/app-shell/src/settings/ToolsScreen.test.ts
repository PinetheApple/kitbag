// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import type { ToolData } from '@kitbag/core-db';
import {
  KB_TOOL_DOWNLOADS,
  type NativeToolInstaller,
  type ToolCatalogueTool,
} from '@kitbag/core-native';
import { configureToolInstall, getToolInstallStore } from '@kitbag/core-state';
import { act, createElement, type ReactNode } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TOOL_DOWNLOADS_TITLE, TURN_OFF } from './toolDownloadsText.ts';
import { DOWNLOADS_OFF_NOTE, TO_DOWNLOAD_LABEL } from './toolsText.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', () => ({ View: 'View', Text: 'Text' }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return {
    useFocusEffect: (effect: () => void) => {
      useEffect(effect, [effect]);
    },
  };
});
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
    Button: host('Button'),
    EditGroup: host('EditGroup'),
    EditRow: host('EditRow'),
    EditValue: host('EditValue'),
    ListRow: host('ListRow'),
    ListSwitchRow: host('ListSwitchRow'),
    SectionHeader: host('SectionHeader'),
    Switch: host('Switch'),
    Sheet: (props: Props) =>
      props.visible === true ? h('Sheet', props, props.children) : null,
    NoticeSnackbar: (props: {
      readonly notice: { readonly shown: { readonly message: string } | null };
    }) =>
      props.notice.shown === null
        ? null
        : h('NoticeSnackbar', { message: props.notice.shown.message }),
    createThemedStyles: () => () => ({}),
  };
});

const { ToolsScreen } = await import('./ToolsScreen.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const RECORDER: ToolCatalogueTool = {
  toolId: 'recorder',
  name: 'Practice recorder',
  icon: 'mic',
  summary: 'Record with the click, play it back',
  version: '0.9.0',
  sizeBytes: 1_600_000,
  capabilities: [],
  installedVersion: null,
  installedManifestSha256: null,
  installedBytes: 0,
  installedProblem: null,
  highWaterVersion: null,
};

const native = {
  downloads: vi.fn<NativeToolInstaller['downloads']>(),
  setDownloads: vi.fn<NativeToolInstaller['setDownloads']>(),
  catalogue: vi.fn<NativeToolInstaller['catalogue']>(),
  install: vi.fn<NativeToolInstaller['install']>(),
  cancel: vi.fn<NativeToolInstaller['cancel']>(),
  remove: vi.fn<NativeToolInstaller['remove']>(),
  onUpdate: () => () => undefined,
} satisfies NativeToolInstaller;

configureToolInstall({
  native,
  toolData: {
    forTool: () => ({ list: () => Promise.resolve([]) }) as unknown as ToolData,
  },
});

const onOpenOptIn = vi.fn<() => void>();
let mounted: ReactTestRenderer | undefined;

async function mount(downloads: KB_TOOL_DOWNLOADS): Promise<ReactTestInstance> {
  native.downloads.mockResolvedValue(downloads);
  await act(async () => {
    mounted = create(
      createElement(ToolsScreen, {
        onBack: () => undefined,
        onOpenTool: () => undefined,
        onOpenOptIn,
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

function rendered(): string {
  return JSON.stringify(mounted?.toJSON());
}

function downloadsRow(root: ReactTestInstance): ReactTestInstance {
  return root.find(
    (n) => isHost(n, 'EditRow') && n.props.label === TOOL_DOWNLOADS_TITLE,
  );
}

async function press(node: ReactTestInstance): Promise<void> {
  await act(async () => {
    (node.props.onPress as () => void)();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  native.catalogue.mockResolvedValue({
    hostVersionName: '0.31.0',
    indexProblem: null,
    highWaterProblem: null,
    tools: [RECORDER],
  });
  native.setDownloads.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => {
    mounted?.unmount();
  });
  getToolInstallStore().setState({ catalogue: null, downloads: null });
});

describe('Settings, Tools', () => {
  it('says so when downloads cannot be turned off', async () => {
    native.setDownloads.mockRejectedValue(new Error('E_TOOL_IO'));
    const root = await mount(KB_TOOL_DOWNLOADS.on);
    await press(downloadsRow(root));
    await press(
      root.find((n) => isHost(n, 'Button') && n.props.label === TURN_OFF),
    );
    expect(rendered()).toContain('Could not change tool downloads.');
  });

  it('lists what can be downloaded with no Downloads group before anyone asked (0c)', async () => {
    const root = await mount(KB_TOOL_DOWNLOADS.unasked);
    expect(rendered()).toContain(TO_DOWNLOAD_LABEL);
    expect(root.findAll((n) => isHost(n, 'ListRow'))).toHaveLength(1);
    expect(
      root.findAll(
        (n) => isHost(n, 'EditRow') && n.props.label === TOOL_DOWNLOADS_TITLE,
      ),
    ).toHaveLength(0);
  });

  it('keeps the list with a note while downloads are off, and opens the opt-in to turn them on (7c)', async () => {
    const root = await mount(KB_TOOL_DOWNLOADS.off);
    expect(rendered()).toContain(DOWNLOADS_OFF_NOTE);
    expect(root.findAll((n) => isHost(n, 'ListRow'))).toHaveLength(1);
    await press(downloadsRow(root));
    expect(onOpenOptIn).toHaveBeenCalledOnce();
    expect(native.setDownloads).not.toHaveBeenCalled();
  });

  it('says a removed tool kept its data (6d)', async () => {
    native.downloads.mockResolvedValue(KB_TOOL_DOWNLOADS.on);
    getToolInstallStore().setState({
      catalogue: {
        hostVersionName: '0.31.0',
        indexProblem: null,
        highWaterProblem: null,
        tools: [RECORDER],
      },
      data: { recorder: { bytes: 38_000_000, items: 12 } },
    });
    await act(async () => {
      mounted = create(
        createElement(ToolsScreen, {
          onBack: () => undefined,
          onOpenTool: () => undefined,
          onOpenOptIn,
          removedToolId: 'recorder',
        }),
      );
      await Promise.resolve();
    });
    const snack =
      mounted?.root.findAll((n) => isHost(n, 'NoticeSnackbar')) ?? [];
    expect(snack.map((n) => n.props.message as unknown)).toEqual([
      'Practice recorder removed. Its data is kept.',
    ]);
  });

  it('asks before turning downloads off (2b)', async () => {
    const root = await mount(KB_TOOL_DOWNLOADS.on);
    await press(downloadsRow(root));
    expect(native.setDownloads).not.toHaveBeenCalled();
    await press(
      root.find((n) => isHost(n, 'Button') && n.props.label === TURN_OFF),
    );
    expect(native.setDownloads).toHaveBeenCalledExactlyOnceWith(
      KB_TOOL_DOWNLOADS.off,
    );
  });
});
