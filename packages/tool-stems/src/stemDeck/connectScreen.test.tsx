import { themes } from '@kitbag/core-design';
import { stemDeckStore } from '@kitbag/core-state';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddStemSongSheet } from './AddStemSongSheet.tsx';
import { CameraExplainerScreen } from './CameraExplainerScreen.tsx';
import { ConnectScreen } from './ConnectScreen.tsx';
import { SongListScreen } from './SongListScreen.tsx';
import {
  CATALOG,
  connected,
  mount,
  ORIGIN,
  resetStemDeck,
  SONG_A,
} from './stemDeckHarness.test-helper.tsx';

const INSETS = { top: 0, bottom: 0 };
const FINGERPRINT = '4f2a91c07be355d8'.padEnd(64, '0');
const NEW_PRINT = 'c81e0d47a9f32b66'.padEnd(64, '0');
const DAY_MS = 86_400_000;

function connectScreen(onExplainCamera = vi.fn(), onConnected = vi.fn()) {
  return (
    <ConnectScreen
      insets={INSETS}
      onBack={vi.fn()}
      onConnected={onConnected}
      onExplainCamera={onExplainCamera}
    />
  );
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('the Add a stem song sheet', () => {
  it('offers this phone and StemDeck on Wi-Fi', async () => {
    const onFromPhone = vi.fn();
    const onFromStemDeck = vi.fn();
    const screen = await mount(
      <AddStemSongSheet
        visible
        bottomInset={0}
        onDismiss={vi.fn()}
        onFromPhone={onFromPhone}
        onFromStemDeck={onFromStemDeck}
      />,
    );
    expect(screen.has('A StemDeck .zip or its folder')).toBe(true);
    expect(screen.has('Scan its QR code or type its address')).toBe(true);
    await screen.press('From StemDeck on Wi-Fi');
    expect(onFromStemDeck).toHaveBeenCalledOnce();
    await screen.press('From this phone');
    expect(onFromPhone).toHaveBeenCalledOnce();
  });
});

describe('opening Connect', () => {
  const LOADING = 'Getting the song list from StemDeck…';
  const WAY_MAKER = 'Way Maker, Sinach · 8:01 · 6 stems';

  function reopened() {
    const { native } = resetStemDeck();
    native.getJson.mockReturnValue(new Promise(() => undefined));
    connected();
    stemDeckStore.setState({ selected: [SONG_A], setlistId: 's1', query: 'w' });
    return native;
  }

  it('goes straight to the song list when already connected', async () => {
    const native = reopened();
    const onConnected = vi.fn();
    await mount(connectScreen(vi.fn(), onConnected));
    expect(onConnected).toHaveBeenCalledOnce();
    expect(stemDeckStore.getState()).toMatchObject({
      connection: { status: 'connected' },
      catalog: CATALOG,
      selected: [],
      setlistId: null,
      query: '',
    });
    expect(native.getJson).toHaveBeenCalled();
  });

  it('shows the cached songs while the list reloads', async () => {
    reopened();
    const screen = await mount(
      <>
        {connectScreen()}
        <SongListScreen
          insets={INSETS}
          onBack={vi.fn()}
          onImporting={vi.fn()}
        />
      </>,
    );
    expect(screen.has(LOADING)).toBe(false);
    expect(screen.labelled(WAY_MAKER)).toHaveLength(1);
  });

  it('stays on Connect when not connected', async () => {
    resetStemDeck();
    const onConnected = vi.fn();
    const screen = await mount(connectScreen(vi.fn(), onConnected));
    expect(onConnected).not.toHaveBeenCalled();
    expect(screen.has('Connect to StemDeck')).toBe(true);
  });
});

describe('connecting', () => {
  it('says nothing answered at the address when the server is out of reach', async () => {
    const { native } = resetStemDeck();
    native.probe.mockRejectedValue(
      Object.assign(new Error('unreachable'), { code: 'unreachable' }),
    );
    const screen = await mount(connectScreen());
    await act(() => stemDeckStore.getState().connect(ORIGIN));
    expect(screen.has('Can’t reach StemDeck')).toBe(true);
    expect(
      screen.has(
        'Nothing answered at 192.168.1.50:8443. Check that StemDeck is open on the computer, that this phone is on the same Wi-Fi, and that the address matches the one StemDeck shows.',
      ),
    ).toBe(true);
  });

  it('marks an incomplete address under the field and contacts nothing', async () => {
    const { native } = resetStemDeck();
    const screen = await mount(connectScreen());
    await act(() => stemDeckStore.getState().connect('192.168.1'));
    expect(
      screen.has('That isn’t a full address. It looks like 192.168.1.50:8443.'),
    ).toBe(true);
    expect(screen.has('Can’t reach StemDeck')).toBe(false);
    expect(screen.byLabel('StemDeck address').props.value).toBe('192.168.1');
    expect(native.probe).not.toHaveBeenCalled();
  });

  it('lists recent servers with how each is trusted, and forgets one', async () => {
    const { native } = resetStemDeck();
    const now = Date.now();
    native.knownServers.mockResolvedValue([
      {
        origin: ORIGIN,
        fingerprint: FINGERPRINT,
        trustedAt: now,
        lastUsedAt: now,
        plain: false,
      },
      {
        origin: 'http://10.0.0.12:8000',
        fingerprint: null,
        trustedAt: now,
        lastUsedAt: now - DAY_MS,
        plain: true,
      },
    ]);
    const screen = await mount(connectScreen());
    expect(screen.has('192.168.1.50:8443')).toBe(true);
    expect(screen.has('Trusted · last used today')).toBe(true);
    expect(screen.has('http://10.0.0.12:8000')).toBe(true);
    expect(screen.has('Not encrypted · last used yesterday')).toBe(true);
    await screen.press('Actions for 192.168.1.50:8443');
    await screen.press('Forget');
    expect(native.forget).toHaveBeenCalledWith(ORIGIN);
  });
});

describe('scanning', () => {
  it('explains the camera first when it is not allowed', async () => {
    const { native } = resetStemDeck('denied');
    const onExplainCamera = vi.fn();
    const screen = await mount(connectScreen(onExplainCamera));
    await screen.press('Scan QR code');
    expect(onExplainCamera).toHaveBeenCalledOnce();
    expect(native.scanQr).not.toHaveBeenCalled();
  });

  it('opens the scanner straight away when the camera is allowed', async () => {
    const { native } = resetStemDeck('granted');
    const onExplainCamera = vi.fn();
    const screen = await mount(connectScreen(onExplainCamera));
    await screen.press('Scan QR code');
    expect(native.scanQr).toHaveBeenCalledOnce();
    expect(onExplainCamera).not.toHaveBeenCalled();
    expect(native.probe).not.toHaveBeenCalled();
  });

  it('puts the cursor in the address field when the user would rather type', async () => {
    resetStemDeck('denied');
    const onBack = vi.fn();
    const screen = await mount(
      <>
        {connectScreen()}
        <CameraExplainerScreen insets={INSETS} onBack={onBack} />
      </>,
    );
    await screen.press('Type the address instead');
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.focus).toHaveBeenCalledOnce();
  });

  it('asks Android from the explainer and goes back once allowed', async () => {
    const { camera, native } = resetStemDeck('granted');
    const onBack = vi.fn();
    const screen = await mount(
      <CameraExplainerScreen insets={INSETS} onBack={onBack} />,
    );
    await screen.tap('Allow camera');
    expect(camera.request).toHaveBeenCalledOnce();
    expect(native.scanQr).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('trusting a server', () => {
  it('shows the first 8 bytes of the fingerprint in 4 groups', async () => {
    const { native } = resetStemDeck();
    native.probe.mockResolvedValue({
      trust: 'new',
      fingerprint: FINGERPRINT,
      previousFingerprint: null,
      health: {
        status: 200,
        contentType: 'application/json',
        body: '{"name":"StemDeck","version":"2.4.0"}',
      },
    });
    const screen = await mount(connectScreen());
    await act(() => stemDeckStore.getState().connect(ORIGIN));
    expect(screen.has('Trust this StemDeck?')).toBe(true);
    expect(screen.has('4F2A 91C0 7BE3 55D8')).toBe(true);
    expect(screen.has('StemDeck 2.4.0')).toBe(true);
    await screen.press('Trust');
    expect(native.trust).toHaveBeenCalledWith(ORIGIN, FINGERPRINT);
  });

  it('makes not connecting the main choice when the certificate changed', async () => {
    const { native } = resetStemDeck();
    native.probe.mockResolvedValue({
      trust: 'changed',
      fingerprint: NEW_PRINT,
      previousFingerprint: FINGERPRINT,
      health: null,
    });
    const screen = await mount(connectScreen());
    await act(() => stemDeckStore.getState().connect(ORIGIN));
    expect(screen.has('4F2A 91C0 7BE3 55D8')).toBe(true);
    expect(screen.has('C81E 0D47 A9F3 2B66')).toBe(true);
    const [face] = screen.byLabel('Don’t connect').children;
    const style = [face && typeof face !== 'string' ? face.props.style : null]
      .flat(Infinity)
      .reduce<Record<string, unknown>>(
        (merged, part) => ({ ...merged, ...(part as object) }),
        {},
      );
    expect(style.backgroundColor).toBe(themes.dark.accentTextFill);
    await screen.press('Don’t connect');
    expect(stemDeckStore.getState().connection.status).toBe('idle');
    expect(native.trust).not.toHaveBeenCalled();
  });
});
