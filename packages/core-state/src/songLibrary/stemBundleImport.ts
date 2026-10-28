import type { StemSetFiles } from '@kitbag/core-db';
import type {
  ImportedStemBundle,
  LibraryConstants,
  StemBundleCheck,
} from '@kitbag/core-native';

import {
  errorCode,
  newStemBundle,
  refusal,
  refusalReason,
  stemFolderName,
  stemSetRemovals,
  type BundleRefusalReason,
} from './stemBundleLogic.ts';
import type { SongLibraryDeps } from './store.ts';
import {
  deleteLeftovers,
  loadCodes,
  warn,
  whileImporting,
  type Get,
  type SetState,
} from './storeSupport.ts';

export interface BundleSource {
  readonly uri: string;
  readonly name: string;
  readonly isFolder: boolean;
}

interface Pending {
  readonly source: BundleSource;
  readonly check: StemBundleCheck;
}

type Copied =
  | { readonly ok: true; readonly imported: ImportedStemBundle }
  | { readonly ok: false; readonly reason: BundleRefusalReason | null };

async function checkBundle(
  deps: SongLibraryDeps,
  source: BundleSource,
): Promise<StemBundleCheck | null> {
  try {
    return await deps.files().checkStemBundle(source.uri, source.isFolder);
  } catch (error) {
    warn(`check of ${source.name} failed`, error);
    return null;
  }
}

// A lookup that fails is treated as no match: the job id's unique index still
// refuses a duplicate insert, which then cleans up as any failed add does.
async function findExisting(deps: SongLibraryDeps, jobId: string) {
  try {
    return await deps.records().findStemSetByJobId(jobId);
  } catch (error) {
    warn(`looking up ${jobId} failed`, error);
    return undefined;
  }
}

async function copyBundle(
  deps: SongLibraryDeps,
  source: BundleSource,
  codes: LibraryConstants,
): Promise<Copied> {
  try {
    const imported = await deps
      .files()
      .importStemBundle(source.uri, source.isFolder);
    return { ok: true, imported };
  } catch (error) {
    warn(`copy of ${source.name} failed`, error);
    return { ok: false, reason: refusalReason(errorCode(error), codes) };
  }
}

async function store(
  deps: SongLibraryDeps,
  imported: ImportedStemBundle,
  replace: boolean,
): Promise<StemSetFiles | null> {
  const bundle = newStemBundle(imported, deps.newUuid());
  const records = deps.records();
  if (!replace) {
    await records.insertStemBundle(bundle);
    return null;
  }
  return (await records.replaceStemBundle(bundle)).replaced;
}

export function stemBundleActions(
  deps: SongLibraryDeps,
  set: SetState,
  get: Get,
) {
  let pending: Pending | null = null;

  const refuse = (
    source: BundleSource,
    reason: BundleRefusalReason,
    check: StemBundleCheck | null,
  ) => {
    set({
      notice: {
        kind: 'bundleRefused',
        name: source.name,
        refusal: refusal(reason, check),
      },
    });
  };

  const copyAndStore = async (
    { source, check }: Pending,
    codes: LibraryConstants,
    replace: boolean,
  ) => {
    const copied = await copyBundle(deps, source, codes);
    if (!copied.ok) {
      if (copied.reason === null)
        set({ notice: { kind: 'copyFailed', name: source.name } });
      else refuse(source, copied.reason, check);
      return;
    }
    const files = deps.files();
    let replaced: StemSetFiles | null;
    try {
      replaced = await store(deps, copied.imported, replace);
    } catch (error) {
      warn(`adding ${source.name} failed`, error);
      const name = stemFolderName(copied.imported.relativeDir, codes.stemsDir);
      if (name !== null)
        await deleteLeftovers(
          files,
          [{ kind: 'stemFolder', name }],
          source.name,
        );
      set({ notice: { kind: 'addFailed', name: source.name } });
      return;
    }
    if (replaced !== null)
      await deleteLeftovers(
        files,
        stemSetRemovals(replaced, codes.stemsDir),
        source.name,
      );
  };

  const run = async (job: Pending, replace: boolean) => {
    const codes = loadCodes(deps, get);
    set({ codes });
    if (codes === null) {
      set({ notice: { kind: 'copyFailed', name: job.source.name } });
      return;
    }
    await whileImporting(set, get, job.source.name, () =>
      copyAndStore(job, codes, replace),
    );
    await get().refresh();
  };

  const examine = async (source: BundleSource) => {
    const codes = loadCodes(deps, get);
    set({ codes });
    if (codes === null) {
      set({ notice: { kind: 'copyFailed', name: source.name } });
      return null;
    }
    const check = await checkBundle(deps, source);
    if (check === null) {
      refuse(source, 'unreadable', null);
      return null;
    }
    if (check.refusal !== '') {
      refuse(
        source,
        refusalReason(check.refusal, codes) ?? 'unreadable',
        check,
      );
      return null;
    }
    return { check, existing: await findExisting(deps, check.jobId) };
  };

  return {
    importBundle: async (source: BundleSource) => {
      const examined = await whileImporting(set, get, source.name, () =>
        examine(source),
      );
      if (examined === null) return;
      const job = { source, check: examined.check };
      if (examined.existing === undefined) {
        await run(job, false);
        return;
      }
      pending = job;
      set({
        replacePrompt: { name: source.name, title: examined.existing.title },
      });
    },
    confirmReplace: async () => {
      const job = pending;
      pending = null;
      set({ replacePrompt: null });
      if (job !== null) await run(job, true);
    },
    cancelReplace: () => {
      pending = null;
      set({ replacePrompt: null });
    },
  };
}
