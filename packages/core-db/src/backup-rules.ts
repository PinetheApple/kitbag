export interface BackupRules {
  readonly latencyOffsetMs: { readonly min: number; readonly max: number };
  readonly deviceRoutes: readonly string[];
}
