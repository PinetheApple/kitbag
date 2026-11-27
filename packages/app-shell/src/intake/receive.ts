import type { PickedBackup, PickedDocument } from '@kitbag/core-native';
import { planIntake, type IntakePlan } from '@kitbag/core-state';

import { HOME_TOOLS, TOOL_ID, type ToolOnTest } from '../home/registry.ts';
import { RESTORE_ROUTE } from '../settings/settingsRoutes.ts';
import { RESTORE_BUSY_TEXT, skippedText, turnOnText } from './intakeText.ts';

export interface IntakeDeps {
  readonly backupMimeType: () => string;
  readonly isOn: ToolOnTest;
  readonly navigate: (route: string) => void;
  readonly notify: (message: string) => void;
  readonly importDocuments: (docs: readonly PickedDocument[]) => Promise<void>;
  readonly openBackup: (
    read: () => Promise<PickedBackup | null>,
  ) => Promise<boolean>;
  readonly readBackup: (uri: string) => Promise<PickedBackup>;
}

type ImportPlan = Extract<IntakePlan, { readonly kind: 'import' }>;
type RestorePlan = Extract<IntakePlan, { readonly kind: 'restore' }>;

function tool(id: string) {
  const entry = HOME_TOOLS.find((candidate) => candidate.id === id);
  if (entry?.homeTile === undefined) throw new Error(`No tool ${id}`);
  return { id, name: entry.name, route: entry.homeTile.route };
}

const SONGS = tool(TOOL_ID.library);
const STEM_SONGS = tool(TOOL_ID.stems);

async function openRestore(plan: RestorePlan, deps: IntakeDeps) {
  if (plan.skipped.length > 0) deps.notify(skippedText(plan.skipped.length));
  deps.navigate(RESTORE_ROUTE);
  const opened = await deps.openBackup(() => deps.readBackup(plan.backup.uri));
  if (!opened) deps.notify(RESTORE_BUSY_TEXT);
}

async function importAll(plan: ImportPlan, deps: IntakeDeps) {
  const needed = [
    ...(plan.songs.length > 0 ? [SONGS] : []),
    ...(plan.stemSongs.length > 0 ? [STEM_SONGS] : []),
  ];
  const off = needed.filter(({ id }) => !deps.isOn(id));
  if (off.length > 0) {
    deps.notify(
      turnOnText(
        off.map(({ name }) => name),
        plan.docs.length,
      ),
    );
    return;
  }
  deps.navigate((needed[0] ?? SONGS).route);
  await deps.importDocuments(plan.docs);
}

export async function receiveIntake(
  items: readonly PickedDocument[],
  deps: IntakeDeps,
): Promise<void> {
  const plan = planIntake(items, deps.backupMimeType());
  if (plan.kind === 'restore') await openRestore(plan, deps);
  else if (plan.kind === 'import') await importAll(plan, deps);
}
