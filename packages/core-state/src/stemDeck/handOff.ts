import type {
  StemDeckConstants,
  StemDeckImportItem,
  StemDeckImportSnapshot,
} from '@kitbag/core-native';

import type { BundleAddOutcome } from '../songLibrary/stemBundleLogic.ts';
import type { SongLibraryActions } from '../songLibrary/store.ts';
import { warn } from '../songLibrary/storeSupport.ts';
import { replaceChoiceOf } from './replaceCodes.ts';

export interface HandOffDeps {
  readonly addFetchedBundle: SongLibraryActions['addFetchedBundle'];
  readonly settle: (jobId: string, outcome: string) => void;
  readonly settled: (jobId: string, outcome: BundleAddOutcome | null) => void;
}

export interface HandOff {
  readonly receive: (
    snapshot: StemDeckImportSnapshot,
    codes: StemDeckConstants,
  ) => Promise<void>;
}

function settleCode(
  outcome: BundleAddOutcome | null,
  codes: StemDeckConstants,
): string {
  switch (outcome?.kind) {
    case 'added':
      return codes.settleAdded;
    case 'alreadyInLibrary':
      return codes.settleSkipped;
    case 'refused':
      return codes.settleRefused;
    default:
      return codes.settleFailed;
  }
}

// Native waits on every finished download until JS settles it, so each one is
// settled exactly once, whether the import succeeds, refuses or throws.
export function createHandOff(deps: HandOffDeps): HandOff {
  const handling = new Set<string>();
  const done = new Set<string>();

  const take = async (
    item: StemDeckImportItem,
    uri: string,
    codes: StemDeckConstants,
  ) => {
    let outcome: BundleAddOutcome | null = null;
    try {
      outcome = await deps.addFetchedBundle(
        { uri, name: item.title, isFolder: false },
        replaceChoiceOf(item, codes),
      );
    } catch (error) {
      warn(`adding ${item.title} from StemDeck failed`, error);
    }
    handling.delete(uri);
    done.add(uri);
    deps.settle(item.jobId, settleCode(outcome, codes));
    deps.settled(item.jobId, outcome);
  };

  return {
    receive: async (snapshot, codes) => {
      const adding = new Map<string, StemDeckImportItem>();
      for (const item of snapshot.items)
        if (item.state === codes.stateAdding && item.fileUri !== null)
          adding.set(item.fileUri, item);
      for (const uri of done) if (!adding.has(uri)) done.delete(uri);
      const fresh = [...adding].filter(
        ([uri]) => !handling.has(uri) && !done.has(uri),
      );
      for (const [uri] of fresh) handling.add(uri);
      await Promise.all(fresh.map(([uri, item]) => take(item, uri, codes)));
    },
  };
}
