import type { ComponentType } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export const TOOL_ID = '[a-z][a-z0-9-]{1,31}';
export const TOOL_ID_PATTERN = new RegExp(`^${TOOL_ID}$`);

// A bare string so the contract does not retype the icon set core-design owns.
export type IconName = string;

// React-agnostic, so any component is assignable without a React import here.
export type PluginScreen = (
  props: Readonly<Record<string, unknown>>,
) => unknown;

export interface RouteDescriptor {
  readonly path: string;
  readonly screen: PluginScreen;
}

export interface HomeTileDescriptor {
  readonly label: string;
  readonly route: string;
}

export type SettingsSchema = Readonly<Record<string, unknown>>;

// Placeholder shapes: the work that first renders each contribution fixes it.
export type MiniPlayerContribution = PluginScreen;
export type HomeSubtextContribution = PluginScreen;
export type SettingsSectionContribution = PluginScreen;
export type MetronomeEntryDescriptor = HomeTileDescriptor;

export interface ToolPlugin {
  readonly id: string;
  readonly name: string;
  readonly icon: IconName;
  readonly routes: readonly RouteDescriptor[];
  readonly homeTile?: HomeTileDescriptor;
  readonly settingsSchema?: SettingsSchema;
  readonly requires?: readonly string[];
  readonly miniPlayer?: MiniPlayerContribution;
  readonly homeSubtext?: HomeSubtextContribution;
  readonly settingsSection?: SettingsSectionContribution;
  readonly metronomeEntry?: MetronomeEntryDescriptor;
}

export interface HostApiVersion {
  readonly major: number;
  readonly minor: number;
}

// Called inside a frame callback on the UI thread; the result goes to a SharedValue.
export type WorkletRead = () => number;

export interface ToolEngineReads {
  readonly barPhase: WorkletRead;
  readonly currentBeat: WorkletRead;
  readonly currentBpm: WorkletRead;
}

export interface ToolEngine {
  readonly reads: ToolEngineReads;
}

export type ToolStateUpdate<S> = Partial<S> | ((state: S) => Partial<S>);

export interface ToolStore<S> {
  <T>(selector: (state: S) => T): T;
  readonly getState: () => S;
  readonly setState: (update: ToolStateUpdate<S>) => void;
  readonly subscribe: (listener: (state: S, previous: S) => void) => () => void;
}

export interface ToolStoreFactory {
  readonly createToolStore: <S extends object>(initial: S) => ToolStore<S>;
}

export interface MixerFrameValues {
  readonly progress: SharedValue<number>;
  readonly playing: SharedValue<number>;
  readonly elapsed: SharedValue<string>;
  readonly second: SharedValue<number>;
  readonly songSec: SharedValue<number>;
  readonly hold: (fraction: number) => void;
}

export interface MixerFrameOptions {
  readonly countEndFrame?: number | null;
  readonly heldFrame?: number | null;
}

export type UseMixerFrame = (
  engineRate: number,
  durationFrames: number,
  loopEndFrames: number | null,
  options?: MixerFrameOptions,
) => MixerFrameValues;

export interface UpNextRowProps {
  readonly songSec: SharedValue<number>;
  readonly onOpenSheet: () => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
}

export interface PlayOrderRoutes {
  readonly onOpenStemSet: (stemSetId: number) => void;
  readonly onOpenSong: (songId: number) => void;
  readonly onOpenMetronome: () => void;
  readonly onNotice: (message: string) => void;
}

export interface QueueSheetProps<Notice, LeftSetlist> extends PlayOrderRoutes {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly playsInPlace: boolean;
  readonly onDismiss: () => void;
  readonly onLeftSetlist: (left: LeftSetlist) => void;
  readonly notice: Notice;
}

// Generic over core-design's Notice and core-state's LeftSetlist, which this package may not import.
export interface ToolListening<Notice = unknown, LeftSetlist = unknown> {
  readonly useMixerFrame: UseMixerFrame;
  readonly UpNextRow: ComponentType<UpNextRowProps>;
  readonly QueueSheet: ComponentType<QueueSheetProps<Notice, LeftSetlist>>;
}

export interface ToolHost<Listening = ToolListening> {
  readonly engine: ToolEngine;
  readonly store: ToolStoreFactory;
  readonly listening: Listening;
}

export type RegisterTool = (host: ToolHost) => ToolPlugin;

export const TOOL_REGISTRY_KEY = '__kitbagTools';
export const TOOL_ENTRY_EXPORT = 'register';

export interface ToolRegistry {
  readonly module: (specifier: string) => unknown;
  readonly register: (id: string, register: RegisterTool) => void;
}
