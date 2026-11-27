import type { IntakeEvent, PickedDocument } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import { intakeSession, type IntakeSource } from './session.ts';

const SONG: PickedDocument = {
  uri: 'content://shared/everlong',
  name: 'Everlong.mp3',
  mimeType: 'audio/mpeg',
};

const LATER: PickedDocument = {
  uri: 'content://shared/redbone',
  name: 'Redbone.stemdeck.zip',
  mimeType: 'application/zip',
};

const event = (...items: PickedDocument[]): IntakeEvent => ({
  items,
  unreadable: 0,
});

const NOTHING = event();

function fakeSource(...held: IntakeEvent[]) {
  const listeners = new Set<() => void>();
  const source: IntakeSource = {
    takeLaunch: vi.fn(() => Promise.resolve(held.shift() ?? NOTHING)),
    watch: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  const share = (intake: IntakeEvent) => {
    held.push(intake);
    for (const listener of listeners) listener();
  };
  return { source, share, listeners };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the intake session', () => {
  it('delivers the files the app was started with', async () => {
    const { source } = fakeSource(event(SONG));
    const receive = vi.fn(() => Promise.resolve());
    intakeSession(source).start(receive);
    await settle();
    expect(receive.mock.calls).toEqual([[event(SONG)]]);
  });

  it('asks the source again on remount and lets it hand the launch files over once', async () => {
    const { source } = fakeSource(event(SONG));
    vi.mocked(source.takeLaunch)
      .mockResolvedValueOnce(event(SONG))
      .mockResolvedValue(NOTHING);
    const session = intakeSession(source);
    const receive = vi.fn(() => Promise.resolve());
    const stop = session.start(receive);
    await settle();
    stop();
    session.start(receive);
    await settle();
    expect(source.takeLaunch).toHaveBeenCalledTimes(2);
    expect(receive.mock.calls).toEqual([[event(SONG)], [NOTHING]]);
  });

  it('delivers files shared while the app is open', async () => {
    const { source, share } = fakeSource(NOTHING);
    const receive = vi.fn(() => Promise.resolve());
    intakeSession(source).start(receive);
    await settle();
    share(event(LATER));
    await settle();
    expect(receive.mock.calls).toEqual([[NOTHING], [event(LATER)]]);
  });

  it('takes a share from the source on each signal, so one held before subscribing is delivered once', async () => {
    const { source, share } = fakeSource();
    share(event(SONG));
    const receive = vi.fn(() => Promise.resolve());
    intakeSession(source).start(receive);
    await settle();
    share(event(LATER));
    await settle();
    expect(receive.mock.calls).toEqual([[event(SONG)], [event(LATER)]]);
  });

  it('stops listening when unmounted', async () => {
    const { source, listeners } = fakeSource(NOTHING);
    const stop = intakeSession(source).start(() => Promise.resolve());
    await settle();
    stop();
    expect(listeners.size).toBe(0);
  });

  it('handles one delivery at a time, so two imports never overlap', async () => {
    const { source, share } = fakeSource(event(SONG));
    let finish: () => void = () => undefined;
    const receive = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    intakeSession(source).start(receive);
    await settle();
    share(event(LATER));
    await settle();
    expect(receive).toHaveBeenCalledOnce();
    finish();
    await settle();
    expect(receive).toHaveBeenCalledTimes(2);
  });

  it('keeps delivering after one delivery fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { source, share } = fakeSource(event(SONG));
    const receive = vi
      .fn<(intake: IntakeEvent) => Promise<void>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);
    intakeSession(source).start(receive);
    await settle();
    share(event(LATER));
    await settle();
    expect(receive).toHaveBeenLastCalledWith(event(LATER));
  });
});
