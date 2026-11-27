import type { PickedDocument } from '@kitbag/core-native';

import type { LibraryNotice } from './store.ts';
import type { Get, SetState } from './storeSupport.ts';

type ImportFailure = Extract<
  LibraryNotice,
  {
    readonly kind:
      'bundleRefused' | 'formatRefused' | 'copyFailed' | 'addFailed';
  }
>;

const FAILED_IMPORTS: ReadonlySet<LibraryNotice['kind']> = new Set([
  'bundleRefused',
  'formatRefused',
  'copyFailed',
  'addFailed',
]);

function isImportFailure(
  notice: LibraryNotice | null,
): notice is ImportFailure {
  return notice !== null && FAILED_IMPORTS.has(notice.kind);
}

function batchNotice(failures: readonly ImportFailure[]): LibraryNotice | null {
  const [only] = failures;
  if (failures.length > 1)
    return { kind: 'importsFailed', names: failures.map(({ name }) => name) };
  return only ?? null;
}

export interface BatchSteps {
  readonly importOne: (doc: PickedDocument) => Promise<void>;
  readonly answered: () => Promise<void>;
}

export async function importEach(
  docs: readonly PickedDocument[],
  steps: BatchSteps,
  set: SetState,
  get: Get,
): Promise<void> {
  const failures: ImportFailure[] = [];
  for (const doc of docs) {
    const before = get().notice;
    await steps.importOne(doc);
    // A lone file returns with its replace prompt open, as before; a batch
    // waits for the answer so two prompts never overlap.
    if (docs.length > 1) await steps.answered();
    const after = get().notice;
    if (after !== before && isImportFailure(after)) failures.push(after);
  }
  const notice = batchNotice(failures);
  if (notice !== null) set({ notice });
}
