import type { StemDeckScanLook } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import { CODES, fakeCamera, ORIGIN, setup } from './store.test-helper.ts';

const LOOK = { title: 'Scan QR code' } as StemDeckScanLook;
const WIFI_QR = 'WIFI:S:Home;T:WPA;P:secret;;';

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('scanning an address', () => {
  it('opens the scanner once the camera is allowed and connects to what it read', async () => {
    const { store, native } = setup();
    native.scanQr.mockResolvedValue({
      outcome: CODES.scanRead,
      text: ORIGIN,
    });
    const answer = await store.getState().scanAddress(LOOK, false);
    await settle();
    expect(answer).toBe('granted');
    expect(native.scanQr).toHaveBeenCalledWith(LOOK);
    expect(native.probe).toHaveBeenCalledWith(ORIGIN);
    expect(store.getState().address).toBe(ORIGIN);
  });

  it.each(['denied', 'blocked'] as const)(
    'leaves the scanner shut when the camera is %s',
    async (refused) => {
      const camera = fakeCamera(refused);
      const { store, native } = setup([], camera);
      expect(await store.getState().scanAddress(LOOK, true)).toBe(refused);
      expect(camera.request).toHaveBeenCalledOnce();
      expect(camera.check).not.toHaveBeenCalled();
      expect(native.scanQr).not.toHaveBeenCalled();
      expect(store.getState().camera).toBe(refused);
    },
  );

  it('only checks, without asking, until the user has seen why', async () => {
    const camera = fakeCamera('denied');
    const { store } = setup([], camera);
    await store.getState().scanAddress(LOOK, false);
    expect(camera.check).toHaveBeenCalledOnce();
    expect(camera.request).not.toHaveBeenCalled();
  });

  it('connects nothing when the scanner closes without a code', async () => {
    const { store, native } = setup();
    await store.getState().scanAddress(LOOK, false);
    await settle();
    expect(native.probe).not.toHaveBeenCalled();
    expect(store.getState().connection.status).toBe('idle');
  });

  it('asks for the address field when the user would rather type it', async () => {
    const { store, native } = setup();
    native.scanQr.mockResolvedValue({
      outcome: CODES.scanTypeAddress,
      text: null,
    });
    const before = store.getState().addressFocus;
    await store.getState().scanAddress(LOOK, false);
    expect(store.getState().addressFocus).toBe(before + 1);
    expect(native.probe).not.toHaveBeenCalled();
  });

  it('shows a code that is not an address as an address problem', async () => {
    const { store, native } = setup();
    native.scanQr.mockResolvedValue({ outcome: CODES.scanRead, text: WIFI_QR });
    await store.getState().scanAddress(LOOK, false);
    await settle();
    expect(store.getState().connection).toEqual({
      status: 'failed',
      address: WIFI_QR,
      failure: 'invalid',
    });
    expect(native.probe).not.toHaveBeenCalled();
  });

  it('says so when the camera would not open, until the next try', async () => {
    const { store, native } = setup();
    native.scanQr.mockResolvedValueOnce({
      outcome: CODES.scanUnavailable,
      text: null,
    });
    await store.getState().scanAddress(LOOK, false);
    expect(store.getState().cameraUnavailable).toBe(true);
    expect(native.probe).not.toHaveBeenCalled();
    await store.getState().scanAddress(LOOK, false);
    expect(store.getState().cameraUnavailable).toBe(false);
  });

  it('treats a scanner that would not open as closed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store, native } = setup();
    native.scanQr.mockRejectedValue(new Error('E_NO_ACTIVITY'));
    expect(await store.getState().scanAddress(LOOK, false)).toBe('granted');
    expect(store.getState().connection.status).toBe('idle');
  });

  it('keeps a seen block when a later check can only say denied', async () => {
    const camera = fakeCamera('blocked');
    const { store } = setup([], camera);
    await store.getState().scanAddress(LOOK, true);
    camera.check.mockResolvedValue('denied');
    expect(await store.getState().scanAddress(LOOK, false)).toBe('blocked');
    camera.check.mockResolvedValue('granted');
    expect(await store.getState().scanAddress(LOOK, false)).toBe('granted');
  });

  it('opens the app settings for a blocked camera', () => {
    const camera = fakeCamera('blocked');
    const { store } = setup([], camera);
    store.getState().openCameraSettings();
    expect(camera.openSettings).toHaveBeenCalledOnce();
  });
});
