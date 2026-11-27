import type { ApplyReport, BackupService } from '@kitbag/core-db';
import type { PickedBackup } from '@kitbag/core-native';

export interface BackupDeps {
  readonly service: () => Pick<
    BackupService,
    | 'summary'
    | 'export'
    | 'exportSetlist'
    | 'plan'
    | 'apply'
    | 'keptBeforeReplace'
  >;
  readonly pick: () => Promise<PickedBackup | null>;
  readonly share: (fileName: string, contents: string) => Promise<void>;
  readonly save: (fileName: string, contents: string) => Promise<boolean>;
  readonly beforeRestore: () => Promise<void>;
  readonly afterRestore: (report: ApplyReport) => Promise<void>;
}

let configured: BackupDeps | undefined;

export function configureBackup(deps: BackupDeps): void {
  configured = deps;
}

export function getBackup(): BackupDeps {
  if (configured === undefined) throw new Error('Backup is not configured');
  return configured;
}
