import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type ToolInstallEvent = Readonly<{
  toolId: string;
  stage: string;
  receivedBytes: CodegenTypes.Double;
  totalBytes: CodegenTypes.Double;
  attempt: CodegenTypes.Int32;
  failure: string | null;
  detail: string | null;
  neededBytes: CodegenTypes.Double;
  freeBytes: CodegenTypes.Double;
}>;

export type ToolCatalogueTool = Readonly<{
  toolId: string;
  name: string | null;
  icon: string | null;
  summary: string | null;
  version: string | null;
  sizeBytes: CodegenTypes.Double;
  capabilities: readonly string[];
  installedVersion: string | null;
  installedManifestSha256: string | null;
  installedBytes: CodegenTypes.Double;
  installedProblem: string | null;
  highWaterVersion: string | null;
}>;

export type ToolCatalogue = Readonly<{
  hostVersionName: string | null;
  indexProblem: string | null;
  highWaterProblem: string | null;
  tools: readonly ToolCatalogueTool[];
}>;

export interface Spec extends TurboModule {
  verifyInstalled(toolId: string): Promise<void>;
  toolDownloads(): Promise<string>;
  setToolDownloads(downloads: string): Promise<void>;
  toolCatalogue(): Promise<ToolCatalogue>;
  installTool(toolId: string, allowOlder: boolean): Promise<boolean>;
  cancelToolInstall(toolId: string): void;
  removeTool(toolId: string): Promise<void>;
  readonly onToolInstall: CodegenTypes.EventEmitter<ToolInstallEvent>;
}

export function getKitbagTools(): Spec {
  return TurboModuleRegistry.getEnforcing<Spec>('KitbagTools');
}
