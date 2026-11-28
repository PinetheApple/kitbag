import type { ExistingStemSet, StemSetFiles } from '@kitbag/core-db';
import type {
  ImportedStemBundle,
  LibraryConstants,
  StemBundleCheck,
} from '@kitbag/core-native';

import {
  errorCode,
  newestSameSong,
  newStemBundle,
  refusal,
  refusalReason,
  stemFolderName,
  stemSetRemovals,
  type BundleAddOutcome,
  type BundleRefusal,
  type BundleRefusalReason,
  type ReplaceChoice,
} from './stemBundleLogic.ts';
import type { FileWorkTracker } from './stemFolderSweep.ts';
import { withFittedTempo } from './stemTempoFit.ts';
import type { LibraryNotice, ReplaceMatch, SongLibraryDeps } from './store.ts';
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

interface Job {
  readonly source: BundleSource;
  readonly check: StemBundleCheck;
  readonly announce: boolean;
}

interface Pending {
  readonly job: Job;
  readonly targetId: number;
  readonly release: (notice: LibraryNotice | null) => void;
}

export type BundleImport =
  | { readonly prompted: false; readonly notice: LibraryNotice | null }
  | {
      readonly prompted: true;
      readonly untilAnswered: Promise<LibraryNotice | null>;
    };

type Examined =
  | { readonly check: StemBundleCheck; readonly match: Match | null }
  | { readonly notice: LibraryNotice };

interface Match {
  readonly set: ExistingStemSet;
  readonly kind: ReplaceMatch;
}

type Inspected =
  | {
      readonly ok: true;
      readonly check: StemBundleCheck;
      readonly existing: ExistingStemSet | undefined;
    }
  | { readonly ok: false; readonly refusal: BundleRefusal };

type Copied =
  | { readonly ok: true; readonly imported: ImportedStemBundle }
  | { readonly ok: false; readonly reason: BundleRefusalReason | null };

function noticeFor(
  name: string,
  outcome: BundleAddOutcome,
  announce: boolean,
): LibraryNotice | null {
  switch (outcome.kind) {
    case 'added':
      return announce ? { kind: 'stemSongAdded', name } : null;
    case 'refused':
      return { kind: 'bundleRefused', name, refusal: outcome.refusal };
    case 'copyFailed':
    case 'addFailed':
      return { kind: outcome.kind, name };
    case 'alreadyInLibrary':
      return null;
  }
}

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

async function findSameSong(
  deps: SongLibraryDeps,
  check: StemBundleCheck,
): Promise<ExistingStemSet | undefined> {
  try {
    return await newestSameSong(deps.records(), check);
  } catch (error) {
    warn(`matching ${check.title} failed`, error);
    return undefined;
  }
}

async function findMatch(
  deps: SongLibraryDeps,
  check: StemBundleCheck,
  byJob: ExistingStemSet | undefined,
): Promise<Match | null> {
  if (byJob !== undefined) return { set: byJob, kind: 'job' };
  const sameSong = await findSameSong(deps, check);
  return sameSong === undefined ? null : { set: sameSong, kind: 'song' };
}

function fetchedTarget(
  byJob: ExistingStemSet | undefined,
  choice: ReplaceChoice,
): number | null {
  if (byJob !== undefined) return byJob.id;
  return choice.kind === 'replaceSet' ? choice.targetId : null;
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

async function persistBundle(
  deps: SongLibraryDeps,
  imported: ImportedStemBundle,
  targetId: number | null,
): Promise<StemSetFiles | null> {
  const bundle = await withFittedTempo(
    deps,
    newStemBundle(imported, deps.newUuid()),
  );
  const records = deps.records();
  if (targetId === null) {
    await records.insertStemBundle(bundle);
    return null;
  }
  return (await records.replaceStemBundle(bundle, targetId)).replaced;
}

export function stemBundleActions(
  deps: SongLibraryDeps,
  set: SetState,
  get: Get,
  imports: FileWorkTracker,
) {
  let pending: Pending | null = null;

  const freshCodes = () => {
    const codes = loadCodes(deps, get);
    set({ codes });
    return codes;
  };

  const copyAndStore = async (
    { source, check }: Pick<Job, 'source' | 'check'>,
    codes: LibraryConstants,
    targetId: number | null,
  ): Promise<BundleAddOutcome> => {
    const copied = await copyBundle(deps, source, codes);
    if (!copied.ok)
      return copied.reason === null
        ? { kind: 'copyFailed' }
        : { kind: 'refused', refusal: refusal(copied.reason, check) };
    const files = deps.files();
    let replaced: StemSetFiles | null;
    try {
      replaced = await persistBundle(deps, copied.imported, targetId);
    } catch (error) {
      warn(`adding ${source.name} failed`, error);
      const name = stemFolderName(copied.imported.relativeDir, codes.stemsDir);
      if (name !== null)
        await deleteLeftovers(
          files,
          [{ kind: 'stemFolder', name }],
          source.name,
        );
      return { kind: 'addFailed' };
    }
    if (replaced !== null)
      await deleteLeftovers(
        files,
        stemSetRemovals(replaced, codes.stemsDir),
        source.name,
      );
    return { kind: 'added' };
  };

  const add = async (
    job: Job,
    targetId: number | null,
  ): Promise<LibraryNotice | null> => {
    const codes = freshCodes();
    if (codes === null) return { kind: 'copyFailed', name: job.source.name };
    const outcome = await whileImporting(set, get, job.source.name, () =>
      imports.track(() => copyAndStore(job, codes, targetId)),
    );
    return noticeFor(job.source.name, outcome, job.announce);
  };

  const run = async (job: Job, targetId: number | null) => {
    const notice = await add(job, targetId);
    if (notice !== null) set({ notice });
    await get().refresh();
    return notice;
  };

  const inspect = async (
    source: BundleSource,
    codes: LibraryConstants,
  ): Promise<Inspected> => {
    const check = await checkBundle(deps, source);
    if (check === null)
      return { ok: false, refusal: refusal('unreadable', null) };
    if (check.refusal !== null) {
      const reason = refusalReason(check.refusal, codes) ?? 'unreadable';
      return { ok: false, refusal: refusal(reason, check) };
    }
    return { ok: true, check, existing: await findExisting(deps, check.jobId) };
  };

  const examine = async (source: BundleSource): Promise<Examined> => {
    const codes = freshCodes();
    if (codes === null)
      return { notice: { kind: 'copyFailed', name: source.name } };
    const inspected = await inspect(source, codes);
    if (inspected.ok)
      return {
        check: inspected.check,
        match: await findMatch(deps, inspected.check, inspected.existing),
      };
    return {
      notice: {
        kind: 'bundleRefused',
        name: source.name,
        refusal: inspected.refusal,
      },
    };
  };

  // Unattended: no prompt and no notice; the caller reports the outcome.
  const addFetchedBundle = async (
    source: BundleSource,
    choice: ReplaceChoice,
  ): Promise<BundleAddOutcome> => {
    const codes = freshCodes();
    if (codes === null) return { kind: 'copyFailed' };
    const inspected = await inspect(source, codes);
    if (!inspected.ok) return { kind: 'refused', refusal: inspected.refusal };
    if (inspected.existing !== undefined && choice.kind === 'add')
      return { kind: 'alreadyInLibrary' };
    const outcome = await imports.track(() =>
      copyAndStore(
        { source, check: inspected.check },
        codes,
        fetchedTarget(inspected.existing, choice),
      ),
    );
    await get().refresh();
    return outcome;
  };

  const takePending = () => {
    const taken = pending;
    pending = null;
    set({ replacePrompt: null });
    return taken;
  };

  const holdForAnswer = (job: Job, targetId: number) => {
    pending?.release(null);
    return new Promise<LibraryNotice | null>((release) => {
      pending = { job, targetId, release };
    });
  };

  const answerWith = async (target: (taken: Pending) => number | null) => {
    const taken = takePending();
    if (taken === null) return;
    let notice: LibraryNotice | null = null;
    try {
      notice = await run(taken.job, target(taken));
    } finally {
      taken.release(notice);
    }
  };

  return {
    importBundle: async (
      source: BundleSource,
      { announce = false }: { readonly announce?: boolean } = {},
    ): Promise<BundleImport> => {
      const examined = await whileImporting(set, get, source.name, () =>
        examine(source),
      );
      if ('notice' in examined) {
        set({ notice: examined.notice });
        return { prompted: false, notice: examined.notice };
      }
      const job = { source, check: examined.check, announce };
      const { match } = examined;
      if (match === null)
        return { prompted: false, notice: await run(job, null) };
      const untilAnswered = holdForAnswer(job, match.set.id);
      set({
        replacePrompt: {
          name: source.name,
          title: match.set.title,
          match: match.kind,
        },
      });
      return { prompted: true, untilAnswered };
    },
    confirmReplace: () => answerWith((taken) => taken.targetId),
    keepBoth: () => answerWith(() => null),
    cancelReplace: () => {
      takePending()?.release(null);
    },
    addFetchedBundle,
  };
}
