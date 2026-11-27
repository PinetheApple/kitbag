import type { BackupRules } from './backup-rules';

export const TEST_BACKUP_RULES: BackupRules = {
  latencyOffsetMs: { min: -250, max: 250 },
  deviceRoutes: ['speaker', 'earpiece', 'wired'],
};
