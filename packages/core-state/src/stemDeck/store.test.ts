import { describe, expect, it, vi } from 'vitest';

import {
  CODES,
  FINGERPRINT,
  item,
  ORIGIN,
  probe,
  rejection,
  setup,
  snapshot,
  text,
} from './store.test-helper.ts';

const A = 'a'.repeat(12);
const B = 'b'.repeat(12);
const NEW_PRINT = 'c81e0d47a9f32b66'.padEnd(64, '0');

describe('connecting', () => {
  it('lists a pinned server straight away', async () => {
    const { store, native } = setup([A]);
    await store.getState().connect('192.168.1.50:8443');
    expect(native.probe).toHaveBeenCalledWith(ORIGIN);
    expect(store.getState().connection).toEqual({
      status: 'connected',
      origin: ORIGIN,
      version: '2.4.0',
    });
    const catalog = store.getState().catalog;
    expect(catalog?.songs.map((s) => [s.jobId, s.inLibrary])).toEqual([
      [A, true],
      [B, false],
    ]);
    expect(catalog?.setlists.map((s) => s.name)).toEqual(['Sunday worship']);
    expect(catalog?.unavailable).toBe(1);
    expect(native.trust).not.toHaveBeenCalled();
  });

  it('asks before trusting a new certificate, then pins it', async () => {
    const { store, native } = setup();
    native.probe.mockResolvedValue(probe({ trust: CODES.trustNew }));
    await store.getState().connect('https://192.168.1.50:8443');
    expect(store.getState().connection).toEqual({
      status: 'trust',
      prompt: {
        kind: 'new',
        origin: ORIGIN,
        version: '2.4.0',
        fingerprint: FINGERPRINT,
      },
    });
    expect(native.getJson).not.toHaveBeenCalled();
    await store.getState().trustServer();
    expect(native.trust).toHaveBeenCalledWith(ORIGIN, FINGERPRINT);
    expect(store.getState().connection.status).toBe('connected');
    expect(store.getState().catalog?.songs).toHaveLength(2);
  });

  it('refuses a changed certificate unless the user trusts the new one', async () => {
    const { store, native } = setup();
    native.probe.mockResolvedValueOnce(
      probe({
        trust: CODES.trustChanged,
        fingerprint: NEW_PRINT,
        previousFingerprint: FINGERPRINT,
        health: null,
      }),
    );
    await store.getState().connect(ORIGIN);
    expect(store.getState().connection).toEqual({
      status: 'trust',
      prompt: {
        kind: 'changed',
        origin: ORIGIN,
        fingerprint: NEW_PRINT,
        previousFingerprint: FINGERPRINT,
      },
    });
    store.getState().declineTrust();
    expect(store.getState().connection).toEqual({ status: 'idle' });
    expect(native.trust).not.toHaveBeenCalled();
    expect(native.getJson).not.toHaveBeenCalled();
  });

  it('re-probes after trusting a changed certificate', async () => {
    const { store, native } = setup();
    native.probe.mockResolvedValueOnce(
      probe({
        trust: CODES.trustChanged,
        fingerprint: NEW_PRINT,
        health: null,
      }),
    );
    await store.getState().connect(ORIGIN);
    await store.getState().trustServer();
    expect(native.trust).toHaveBeenCalledWith(ORIGIN, NEW_PRINT);
    expect(native.probe).toHaveBeenCalledTimes(2);
    expect(store.getState().connection.status).toBe('connected');
  });

  it('says the trust went stale when native no longer matches the shown certificate', async () => {
    const { store, native } = setup();
    native.probe.mockResolvedValue(probe({ trust: CODES.trustNew }));
    native.trust.mockResolvedValue(false);
    await store.getState().connect(ORIGIN);
    await store.getState().trustServer();
    expect(store.getState().connection).toEqual({
      status: 'failed',
      address: ORIGIN,
      failure: 'trustStale',
    });
  });

  it('reports why storing the trust failed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store, native } = setup();
    native.probe.mockResolvedValue(probe({ trust: CODES.trustNew }));
    native.trust.mockRejectedValue(rejection(CODES.failureBadAddress));
    await store.getState().connect(ORIGIN);
    await store.getState().trustServer();
    expect(store.getState().connection).toMatchObject({
      failure: 'badAddress',
    });
  });

  it('shows a changed certificate with no previous pin for a server Android used to vouch for', async () => {
    const { store, native } = setup();
    native.probe.mockResolvedValue(
      probe({ trust: CODES.trustChanged, previousFingerprint: null }),
    );
    await store.getState().connect(ORIGIN);
    expect(store.getState().connection).toMatchObject({
      status: 'trust',
      prompt: { kind: 'changed', previousFingerprint: null },
    });
  });

  it.each([CODES.trustPlain, CODES.trustSystem])(
    'remembers a %s server without a pin',
    async (trust) => {
      const { store, native } = setup();
      native.probe.mockResolvedValue(probe({ trust, fingerprint: null }));
      await store.getState().connect('http://10.0.0.12:8000');
      expect(native.trust).toHaveBeenCalledWith('http://10.0.0.12:8000', null);
      expect(store.getState().connection.status).toBe('connected');
    },
  );

  it('lists nothing from a server that is not StemDeck', async () => {
    const { store, native } = setup();
    native.probe.mockResolvedValue(
      probe({ trust: CODES.trustNew, health: text('{"name":"Plex"}') }),
    );
    await store.getState().connect('https://192.168.1.1');
    expect(store.getState().connection).toEqual({
      status: 'failed',
      address: 'https://192.168.1.1:443',
      failure: 'notStemDeck',
    });
    expect(native.getJson).not.toHaveBeenCalled();
  });

  it('reports an incomplete address without contacting anything', async () => {
    const { store, native } = setup();
    await store.getState().connect('192.168.1');
    expect(store.getState().connection).toEqual({
      status: 'failed',
      address: '192.168.1',
      failure: 'incomplete',
    });
    expect(native.probe).not.toHaveBeenCalled();
  });

  it.each([
    [CODES.failureUnreachable, 'unreachable'],
    [CODES.failureNetworkOff, 'networkOff'],
    [CODES.failureNeedsHttps, 'needsHttps'],
    [CODES.failureHttpNotLocal, 'httpNotLocal'],
    ['E_SOMETHING', 'unknown'],
  ])('maps a probe failure %s to %s', async (code, failure) => {
    const { store, native } = setup();
    native.probe.mockRejectedValue(rejection(code));
    await store.getState().connect(ORIGIN);
    expect(store.getState().connection).toEqual({
      status: 'failed',
      address: ORIGIN,
      failure,
    });
  });

  it('reports a song list it cannot read', async () => {
    const { store, native } = setup();
    native.getJson.mockResolvedValue(text('<html>'));
    await store.getState().connect(ORIGIN);
    expect(store.getState().connection).toMatchObject({
      status: 'failed',
      failure: 'unreadable',
    });
  });

  it('lists songs even when setlists fail', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store, native } = setup();
    native.getJson.mockImplementation((_origin: string, endpoint: string) =>
      endpoint === CODES.endpointJobs
        ? Promise.resolve(text(JSON.stringify([])))
        : Promise.reject(rejection(CODES.failureHttpError)),
    );
    await store.getState().connect(ORIGIN);
    expect(store.getState().catalog).toEqual({
      songs: [],
      setlists: [],
      unavailable: 0,
    });
  });

  it('clears the filters and reloads the song list when reopened', async () => {
    const { store, native } = setup();
    await store.getState().connect(ORIGIN);
    const loads = native.getJson.mock.calls.length;
    store.setState({ selected: [A], setlistId: 's1', query: 'way' });
    const reopened = store.getState().reopenCatalog();
    expect(store.getState()).toMatchObject({
      selected: [],
      setlistId: null,
      query: '',
      loadingCatalog: true,
    });
    expect(store.getState().catalog).not.toBeNull();
    await reopened;
    expect(native.getJson.mock.calls.length).toBeGreaterThan(loads);
    expect(store.getState().connection.status).toBe('connected');
    expect(store.getState().loadingCatalog).toBe(false);
  });

  it('lets only the latest connect attempt land', async () => {
    const { store, native } = setup();
    let first: (value: ReturnType<typeof probe>) => void = () => undefined;
    native.probe.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          first = resolve;
        }),
    );
    const slow = store.getState().connect('192.168.1.60:8443');
    await store.getState().connect('192.168.1');
    first(probe());
    await slow;
    expect(store.getState().connection.status).toBe('failed');
  });

  it('lists recent servers by last use with how each is trusted', async () => {
    const { store, native } = setup();
    native.knownServers.mockResolvedValue([
      {
        origin: 'http://10.0.0.12:8000',
        fingerprint: null,
        trustedAt: 1,
        lastUsedAt: 1,
        plain: true,
      },
      {
        origin: ORIGIN,
        fingerprint: FINGERPRINT,
        trustedAt: 1,
        lastUsedAt: 5,
        plain: false,
      },
    ]);
    await store.getState().loadRecents();
    expect(store.getState().recents.map((r) => [r.origin, r.trust])).toEqual([
      [ORIGIN, 'pinned'],
      ['http://10.0.0.12:8000', 'plain'],
    ]);
    await store.getState().forgetServer(ORIGIN);
    expect(native.forget).toHaveBeenCalledWith(ORIGIN);
  });
});

describe('picking and importing', () => {
  async function connected(owned: readonly string[] = []) {
    const context = setup(owned);
    await context.store.getState().start();
    await context.store.getState().connect(ORIGIN);
    return context;
  }

  it('sends the picked songs with their lanes and clears the selection', async () => {
    const { store, native } = await connected();
    store.getState().selectSongs([B]);
    await store.getState().importSelected();
    expect(native.startImport).toHaveBeenCalledWith(ORIGIN, [
      { jobId: B, title: 'Gratitude', stems: ['vocals', 'drums', 'bass'] },
    ]);
    expect(store.getState().selected).toEqual([]);
  });

  it('asks before replacing songs already in the library', async () => {
    const { store, native, emit, addFetchedBundle } = await connected([A]);
    store.getState().selectSongs([A, B]);
    await store.getState().importSelected();
    expect(store.getState().replacePrompt).toEqual({ titles: ['Way Maker'] });
    expect(native.startImport).not.toHaveBeenCalled();
    await store.getState().replaceInLibrary();
    expect(native.startImport.mock.calls[0]?.[1]).toHaveLength(2);
    emit(snapshot([item(A, CODES.stateAdding, { fileUri: 'file:/x/a.zip' })]));
    await vi.waitFor(() => {
      expect(native.settleDownload).toHaveBeenCalledWith(A, CODES.settleAdded);
    });
    expect(addFetchedBundle).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file:/x/a.zip' }),
      { replace: true },
    );
  });

  it('says whether songs were sent, so only a real start asks for notifications', async () => {
    const { store, native } = await connected([A]);
    store.getState().selectSongs([A]);
    expect(await store.getState().importSelected()).toBe(false);
    expect(await store.getState().keepInLibrary()).toBe(false);
    store.getState().selectSongs([B]);
    expect(await store.getState().importSelected()).toBe(true);
    native.startImport.mockRejectedValueOnce(
      rejection(CODES.failureBadAddress),
    );
    store.getState().selectSongs([B]);
    expect(await store.getState().importSelected()).toBe(false);
  });

  it('keeps the library copy and shows the song as skipped', async () => {
    const { store, native, emit } = await connected([A]);
    store.getState().selectSongs([A, B]);
    await store.getState().importSelected();
    await store.getState().keepInLibrary();
    expect(native.startImport.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ jobId: B }),
    ]);
    emit(snapshot([item(B, CODES.statePreparing)]));
    expect(
      store.getState().importView?.rows.map((r) => [r.jobId, r.phase]),
    ).toEqual([
      [A, 'skipped'],
      [B, 'preparing'],
    ]);
  });

  it('marks a song added from StemDeck as in the library', async () => {
    const { store, emit, native } = await connected();
    emit(snapshot([item(B, CODES.stateAdding, { fileUri: 'file:/x/b.zip' })]));
    await vi.waitFor(() => {
      expect(native.settleDownload).toHaveBeenCalled();
    });
    expect(
      store.getState().catalog?.songs.find((s) => s.jobId === B)?.inLibrary,
    ).toBe(true);
  });

  it('settles a download left over from before a reload', async () => {
    const context = setup();
    context.native.importSnapshot.mockResolvedValue(
      snapshot([item(A, CODES.stateAdding, { fileUri: 'file:/x/a.zip' })]),
    );
    await context.store.getState().start();
    await vi.waitFor(() => {
      expect(context.native.settleDownload).toHaveBeenCalledWith(
        A,
        CODES.settleAdded,
      );
    });
  });

  it('starts listening once', async () => {
    const { store, native } = setup();
    const stop = await store.getState().start();
    expect(await store.getState().start()).toBe(stop);
    expect(native.onImport).toHaveBeenCalledTimes(1);
    stop();
    await store.getState().start();
    expect(native.onImport).toHaveBeenCalledTimes(2);
  });

  it('passes cancel, retry and watching through', async () => {
    const { store, native } = setup();
    store.getState().cancelImport();
    await store.getState().retryImport();
    store.getState().setWatching(false);
    expect(native.cancelImport).toHaveBeenCalled();
    expect(native.retryImport).toHaveBeenCalled();
    expect(native.setWatching).toHaveBeenCalledWith(false);
  });

  it('shows the unity mix note until it has been seen once', async () => {
    const { store, unityNotice } = await connected();
    expect(store.getState().unityNoticeSeen).toBe(false);
    store.getState().markUnityNoticeSeen();
    store.getState().markUnityNoticeSeen();
    expect(unityNotice.save).toHaveBeenCalledTimes(1);
    expect(store.getState().unityNoticeSeen).toBe(true);
  });
});
