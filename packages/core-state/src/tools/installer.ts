import type { ToolDataRepository } from '@kitbag/core-db';
import type { NativeToolInstaller } from '@kitbag/core-native';

export interface ToolInstallerDeps {
  readonly native: NativeToolInstaller;
  readonly toolData: ToolDataRepository;
}

export interface ToolInstaller {
  readonly install: (
    toolId: string,
    options?: { readonly allowOlder?: boolean },
  ) => Promise<boolean>;
  readonly cancel: (toolId: string) => void;
  readonly remove: (
    toolId: string,
    options?: { readonly deleteData?: boolean },
  ) => Promise<void>;
  readonly deleteData: (toolId: string) => Promise<void>;
}

export function createToolInstaller({
  native,
  toolData,
}: ToolInstallerDeps): ToolInstaller {
  const deleteData = (toolId: string) => toolData.forTool(toolId).clear();
  return {
    install: (toolId, options) =>
      native.install(toolId, options?.allowOlder ?? false),
    cancel: native.cancel,
    remove: async (toolId, options) => {
      await native.remove(toolId);
      if (options?.deleteData === true) await deleteData(toolId);
    },
    deleteData,
  };
}
