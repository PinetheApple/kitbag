import {
  KB_TOOL_DOWNLOADS,
  KB_TOOL_INSTALL_STAGE,
  KB_TOOL_REJECTION,
} from './generated/nativeConstants.gen.ts';
import {
  getKitbagTools,
  type ToolCatalogue,
  type ToolInstallEvent,
} from './NativeKitbagTools';

export type ToolInstallUpdate = Readonly<
  Omit<ToolInstallEvent, 'stage' | 'failure'> & {
    stage: KB_TOOL_INSTALL_STAGE;
    failure: KB_TOOL_REJECTION | null;
  }
>;

export interface NativeToolInstaller {
  readonly downloads: () => Promise<KB_TOOL_DOWNLOADS>;
  readonly setDownloads: (downloads: KB_TOOL_DOWNLOADS) => Promise<void>;
  readonly catalogue: () => Promise<ToolCatalogue>;
  readonly install: (toolId: string, allowOlder: boolean) => Promise<boolean>;
  readonly cancel: (toolId: string) => void;
  readonly remove: (toolId: string) => Promise<void>;
  readonly onUpdate: (
    listener: (update: ToolInstallUpdate) => void,
  ) => () => void;
}

function oneOf<T extends string>(
  codes: Readonly<Record<string, T>>,
  value: string | null,
): T | undefined {
  return Object.values(codes).find((code) => code === value);
}

function update(event: ToolInstallEvent): ToolInstallUpdate | undefined {
  const stage = oneOf(KB_TOOL_INSTALL_STAGE, event.stage);
  const failure = oneOf(KB_TOOL_REJECTION, event.failure) ?? null;
  if (stage === undefined || (event.failure !== null && failure === null))
    return undefined;
  return { ...event, stage, failure };
}

async function downloads(
  read: () => Promise<string>,
): Promise<KB_TOOL_DOWNLOADS> {
  const value = await read();
  const known = oneOf(KB_TOOL_DOWNLOADS, value);
  if (known === undefined)
    throw new Error(`unknown tool downloads state ${value}`);
  return known;
}

export function nativeToolInstaller(): NativeToolInstaller {
  const tools = getKitbagTools();
  return {
    downloads: () => downloads(() => tools.toolDownloads()),
    setDownloads: (value) => tools.setToolDownloads(value),
    catalogue: () => tools.toolCatalogue(),
    install: (toolId, allowOlder) => tools.installTool(toolId, allowOlder),
    cancel: (toolId) => {
      tools.cancelToolInstall(toolId);
    },
    remove: (toolId) => tools.removeTool(toolId),
    onUpdate: (listener) => {
      const subscription = tools.onToolInstall((event) => {
        const known = update(event);
        if (known !== undefined) listener(known);
      });
      return () => {
        subscription.remove();
      };
    },
  };
}
