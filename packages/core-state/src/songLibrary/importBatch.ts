import type { SongFiles } from '@kitbag/core-db';
import type { ImportedAudio, PickedDocument } from '@kitbag/core-native';

import {
  audioFormat,
  checkAudioFormat,
  isStemArchive,
  songFolder,
  songRemovals,
} from './logic.ts';
import type { stemBundleActions } from './stemBundleImport.ts';
import type { LibraryNotice, SongLibraryDeps } from './store.ts';
import {
  deleteLeftovers,
  enqueue,
  loadCodes,
  warn,
  whileImporting,
  type Get,
  type SetState,
} from './storeSupport.ts';

const IMPORT_FAILURES = [
  'bundleRefused',
  'formatRefused',
  'copyFailed',
  'addFailed',
] as const satisfies readonly LibraryNotice['kind'][];

type ImportFailure = Extract<
  LibraryNotice,
  { readonly kind: (typeof IMPORT_FAILURES)[number] }
>;

const FAILED_IMPORTS: ReadonlySet<LibraryNotice['kind']> = new Set(
  IMPORT_FAILURES,
);

type ImportOutcome =
  | { readonly ok: true; readonly song: SongFiles }
  | { readonly ok: false; readonly kind: 'copyFailed' | 'addFailed' };

type BatchSteps = Pick<
  ReturnType<typeof stemBundleActions>,
  'importBundle' | 'untilAnswered'
>;

export const isBatch = (docs: readonly PickedDocument[]) => docs.length > 1;

function isImportFailure(
  notice: LibraryNotice | null,
): notice is ImportFailure {
  return notice !== null && FAILED_IMPORTS.has(notice.kind);
}

function batchNotice(failures: readonly ImportFailure[]): LibraryNotice | null {
  if (failures.length > 1)
    return { kind: 'importsFailed', names: failures.map(({ name }) => name) };
  return failures[0] ?? null;
}

async function importAudio(
  deps: SongLibraryDeps,
  doc: PickedDocument,
  songsDir: string,
): Promise<ImportOutcome> {
  const files = deps.files();
  const uuid = deps.newUuid();
  let imported: ImportedAudio;
  try {
    imported = await files.importAudio(doc.uri, songFolder(songsDir, uuid));
  } catch (error) {
    warn(`copy of ${doc.name} failed`, error);
    return { ok: false, kind: 'copyFailed' };
  }
  const song = { uuid, filePath: imported.relativePath, waveformPath: null };
  try {
    await deps.records().insertSong({
      uuid,
      title: imported.title,
      artist: imported.artist,
      filePath: imported.relativePath,
      durationSec: imported.durationSec,
      format: audioFormat(imported.relativePath),
    });
  } catch (error) {
    warn(`adding ${doc.name} failed`, error);
    await deleteLeftovers(files, songRemovals(song, songsDir), doc.name);
    return { ok: false, kind: 'addFailed' };
  }
  return { ok: true, song };
}

export function documentImports(
  deps: SongLibraryDeps,
  set: SetState,
  get: Get,
  bundles: BatchSteps,
) {
  const addAudio = async (
    doc: PickedDocument,
  ): Promise<LibraryNotice | null> => {
    const codes = loadCodes(deps, get);
    set({ codes });
    if (codes === null) return { kind: 'copyFailed', name: doc.name };
    const headerFormat = await deps
      .files()
      .sniffUnsupportedFormat(doc.uri)
      .catch(() => '');
    const check = checkAudioFormat(doc, codes, headerFormat);
    if (!check.supported)
      return {
        kind: 'formatRefused',
        name: doc.name,
        format: check.format,
        supported: codes.supportedAudioFamilies,
      };
    const outcome = await importAudio(deps, doc, codes.songsDir);
    if (!outcome.ok) return { kind: outcome.kind, name: doc.name };
    enqueue(deps.files(), outcome.song, false);
    return null;
  };

  const importDocument = async (doc: PickedDocument) => {
    const notice = await whileImporting(set, get, doc.name, () =>
      addAudio(doc),
    );
    if (notice !== null) set({ notice });
    await get().refresh();
    return notice;
  };

  const importOne = async (doc: PickedDocument) => {
    if (isStemArchive(doc))
      await bundles.importBundle(
        { ...doc, isFolder: false },
        { announce: true },
      );
    else await importDocument(doc);
  };

  return async (docs: readonly PickedDocument[]) => {
    const batch = isBatch(docs);
    const failures: ImportFailure[] = [];
    for (const doc of docs) {
      const before = get().notice;
      await importOne(doc);
      // A lone file returns with its prompt open; a batch waits so two never overlap.
      if (batch) await bundles.untilAnswered();
      const after = get().notice;
      if (after !== before && isImportFailure(after)) failures.push(after);
    }
    const notice = batchNotice(failures);
    if (notice !== null) set({ notice });
  };
}
