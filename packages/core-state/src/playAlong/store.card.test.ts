import { PLAY_ALONG_CARD_ACTION } from '@kitbag/core-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BPM,
  call,
  fakePlayAlong,
  locked,
  SESSION_ID,
  snapshot,
  STANDALONE,
} from './store.test-helper.ts';

const FOLLOWED_CARD = { app: SESSION_ID, title: 'Song', playing: true };

afterEach(() => {
  vi.useRealTimers();
});

describe('the Play along card while following', () => {
  it('shows naming the app and the track, and asks for notifications', () => {
    const fake = locked();
    expect(fake.commands.playAlongCardShow.mock.calls).toEqual([
      [FOLLOWED_CARD],
    ]);
    expect(fake.playbackStarted).toHaveBeenCalledOnce();
  });

  it('does not show before following', () => {
    const fake = fakePlayAlong();
    fake.store.getState().setBpm(BPM);
    expect(fake.commands.playAlongCardShow).not.toHaveBeenCalled();
    expect(fake.playbackStarted).not.toHaveBeenCalled();
  });

  it('shows the other app pausing once', () => {
    const fake = locked();
    fake.report([snapshot({ playing: false })]);
    fake.report([snapshot({ playing: false })]);
    expect(fake.commands.playAlongCardShow.mock.calls).toEqual([
      [FOLLOWED_CARD],
      [{ ...FOLLOWED_CARD, playing: false }],
    ]);
  });

  it('Stop ends the follow and hides the card', () => {
    const fake = locked();
    fake.cardPress(PLAY_ALONG_CARD_ACTION.stop);
    expect(fake.store.getState().lock).toBeUndefined();
    expect(fake.calls).toContain(call('metronomeSelectSlot', STANDALONE));
    expect(fake.commands.playAlongCardHide).toHaveBeenCalledOnce();
  });

  it('play/pause pauses the followed app when it plays', () => {
    const fake = locked();
    fake.cardPress(PLAY_ALONG_CARD_ACTION.playPause);
    expect(fake.sessionCommand).toHaveBeenCalledWith(SESSION_ID, {
      type: 'pause',
    });
    expect(fake.store.getState().lock).toBeDefined();
  });

  it('hides once when the follow ends another way, and stops listening', () => {
    const fake = locked();
    fake.store.getState().unlock();
    fake.cardPress(PLAY_ALONG_CARD_ACTION.stop);
    fake.cardPress(PLAY_ALONG_CARD_ACTION.playPause);
    expect(fake.commands.playAlongCardHide).toHaveBeenCalledOnce();
    expect(fake.sessionCommand).not.toHaveBeenCalled();
  });

  it('hides when a new track ends the follow', () => {
    const fake = locked();
    fake.report([snapshot({ title: 'Next song' })]);
    expect(fake.store.getState().lock).toBeUndefined();
    expect(fake.commands.playAlongCardHide).toHaveBeenCalledOnce();
  });
});
