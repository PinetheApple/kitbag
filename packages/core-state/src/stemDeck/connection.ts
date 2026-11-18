import type {
  StemDeckConstants,
  StemDeckProbe,
  StemDeckServer,
} from '@kitbag/core-native';

import { errorCode } from '../songLibrary/stemBundleLogic.ts';
import { warn } from '../songLibrary/storeSupport.ts';
import { parseAddress } from './address.ts';
import {
  markInLibrary,
  parseHealth,
  parseJobs,
  parseSetlists,
  type Catalog,
} from './catalog.ts';
import { nativeFailure, type StemDeckFailure } from './failures.ts';
import { stemDeckCodes } from './runtime.ts';
import type { Get, SetState, StemDeckDeps } from './store.ts';

export type TrustPrompt =
  | {
      readonly kind: 'new';
      readonly origin: string;
      readonly version: string | null;
      readonly fingerprint: string;
    }
  | {
      readonly kind: 'changed';
      readonly origin: string;
      readonly fingerprint: string;
      readonly previousFingerprint: string | null;
    };

export type Connection =
  | { readonly status: 'idle' }
  | { readonly status: 'connecting'; readonly origin: string }
  | { readonly status: 'trust'; readonly prompt: TrustPrompt }
  | {
      readonly status: 'connected';
      readonly origin: string;
      readonly version: string | null;
    }
  | {
      readonly status: 'failed';
      readonly address: string;
      readonly failure: StemDeckFailure;
    };

export type ServerTrust = 'pinned' | 'system' | 'plain';

export interface RecentServer {
  readonly origin: string;
  readonly trust: ServerTrust;
  readonly lastUsedAt: number;
}

export interface ConnectionState {
  readonly connection: Connection;
  readonly recents: readonly RecentServer[];
  readonly catalog: Catalog | null;
  readonly loadingCatalog: boolean;
}

export interface ConnectionActions {
  loadRecents: () => Promise<void>;
  connect: (address: string) => Promise<void>;
  trustServer: () => Promise<void>;
  declineTrust: () => void;
  forgetServer: (origin: string) => Promise<void>;
  disconnect: () => void;
  refreshCatalog: () => Promise<void>;
}

function recent(server: StemDeckServer): RecentServer {
  const trust: ServerTrust = server.plain
    ? 'plain'
    : server.fingerprint === null
      ? 'system'
      : 'pinned';
  return { origin: server.origin, trust, lastUsedAt: server.lastUsedAt };
}

async function inLibraryIds(
  deps: StemDeckDeps,
  jobIds: readonly string[],
): Promise<Set<string>> {
  const found = await Promise.all(
    jobIds.map(async (jobId) => {
      try {
        return (await deps.inLibrary(jobId)) ? [jobId] : [];
      } catch (error) {
        warn(`library lookup of ${jobId} failed`, error);
        return [];
      }
    }),
  );
  return new Set(found.flat());
}

export function connectionActions(
  deps: StemDeckDeps,
  set: SetState,
  get: Get,
): ConnectionActions {
  let attempt = 0;
  const current = (mine: number) => mine === attempt;

  const fail = (address: string, failure: StemDeckFailure) => {
    set({
      connection: { status: 'failed', address, failure },
      loadingCatalog: false,
    });
  };

  const codesOr = (address: string) => {
    const codes = stemDeckCodes(deps.native, get().codes);
    set({ codes });
    if (codes === null) fail(address, 'unknown');
    return codes;
  };

  const loadRecents = async () => {
    set({ codes: stemDeckCodes(deps.native, get().codes) });
    try {
      const servers = await deps.native().knownServers();
      const recents = servers
        .map(recent)
        .sort((a, b) => b.lastUsedAt - a.lastUsedAt);
      set({ recents });
    } catch (error) {
      warn('StemDeck servers unavailable', error);
    }
  };

  const readCatalog = async (
    origin: string,
    codes: StemDeckConstants,
  ): Promise<Catalog | StemDeckFailure> => {
    const native = deps.native();
    let jobs: ReturnType<typeof parseJobs>;
    try {
      jobs = parseJobs((await native.getJson(origin, codes.endpointJobs)).body);
    } catch (error) {
      return nativeFailure(errorCode(error), codes);
    }
    if (jobs === null) return 'unreadable';
    const setlists = await native
      .getJson(origin, codes.endpointSetlists)
      .then((text) => parseSetlists(text.body))
      .catch((error: unknown) => {
        warn('StemDeck setlists unavailable', error);
        return [];
      });
    const owned = await inLibraryIds(
      deps,
      jobs.songs.map((s) => s.jobId),
    );
    return {
      songs: markInLibrary(jobs.songs, owned),
      setlists,
      unavailable: jobs.unavailable,
    };
  };

  const openCatalog = async (
    mine: number,
    origin: string,
    version: string | null,
    codes: StemDeckConstants,
  ) => {
    set({
      connection: { status: 'connected', origin, version },
      loadingCatalog: true,
    });
    const catalog = await readCatalog(origin, codes);
    if (!current(mine)) return;
    if (typeof catalog === 'string') {
      fail(origin, catalog);
      return;
    }
    set({
      catalog,
      loadingCatalog: false,
      selected: [],
      setlistId: null,
      unityNoticeSeen: deps.unityNotice().load(),
    });
    await loadRecents();
  };

  const remember = async (origin: string) => {
    try {
      await deps.native().trust(origin, null);
    } catch (error) {
      warn('StemDeck server not remembered', error);
    }
  };

  const afterProbe = async (
    mine: number,
    origin: string,
    probe: StemDeckProbe,
    codes: StemDeckConstants,
  ) => {
    if (probe.trust === codes.trustChanged && probe.fingerprint !== null) {
      const prompt = {
        kind: 'changed',
        origin,
        fingerprint: probe.fingerprint,
        previousFingerprint: probe.previousFingerprint,
      } as const;
      set({ connection: { status: 'trust', prompt } });
      return;
    }
    const health = parseHealth(probe.health?.body ?? '');
    if (!health.isStemDeck) {
      fail(origin, 'notStemDeck');
      return;
    }
    if (probe.trust === codes.trustNew && probe.fingerprint !== null) {
      const prompt = {
        kind: 'new',
        origin,
        version: health.version,
        fingerprint: probe.fingerprint,
      } as const;
      set({ connection: { status: 'trust', prompt } });
      return;
    }
    if (probe.trust !== codes.trustPinned) await remember(origin);
    await openCatalog(mine, origin, health.version, codes);
  };

  const reach = async (origin: string, codes: StemDeckConstants) => {
    attempt += 1;
    const mine = attempt;
    set({
      connection: { status: 'connecting', origin },
      catalog: null,
      selected: [],
    });
    let probe: StemDeckProbe;
    try {
      probe = await deps.native().probe(origin);
    } catch (error) {
      if (current(mine)) fail(origin, nativeFailure(errorCode(error), codes));
      return;
    }
    if (current(mine)) await afterProbe(mine, origin, probe, codes);
  };

  return {
    loadRecents,
    connect: async (address: string) => {
      set({ address });
      const parsed = parseAddress(address);
      if (!parsed.ok) {
        attempt += 1;
        fail(address, parsed.problem);
        return;
      }
      const codes = codesOr(parsed.origin);
      if (codes !== null) await reach(parsed.origin, codes);
    },
    trustServer: async () => {
      const { connection } = get();
      const codes = stemDeckCodes(deps.native, get().codes);
      if (connection.status !== 'trust' || codes === null) return;
      const { prompt } = connection;
      let trusted: boolean;
      try {
        trusted = await deps.native().trust(prompt.origin, prompt.fingerprint);
      } catch (error) {
        warn('StemDeck certificate not stored', error);
        fail(prompt.origin, nativeFailure(errorCode(error), codes));
        return;
      }
      if (!trusted) fail(prompt.origin, 'trustStale');
      else if (prompt.kind === 'changed') await reach(prompt.origin, codes);
      else await openCatalog(attempt, prompt.origin, prompt.version, codes);
    },
    declineTrust: () => {
      attempt += 1;
      set({ connection: { status: 'idle' } });
    },
    disconnect: () => {
      attempt += 1;
      set({
        connection: { status: 'idle' },
        catalog: null,
        selected: [],
        setlistId: null,
        query: '',
      });
    },
    forgetServer: async (origin: string) => {
      try {
        await deps.native().forget(origin);
      } catch (error) {
        warn('StemDeck server not forgotten', error);
      }
      await loadRecents();
    },
    refreshCatalog: async () => {
      const { connection } = get();
      const codes = stemDeckCodes(deps.native, get().codes);
      if (connection.status !== 'connected' || codes === null) return;
      await openCatalog(attempt, connection.origin, connection.version, codes);
    },
  };
}
