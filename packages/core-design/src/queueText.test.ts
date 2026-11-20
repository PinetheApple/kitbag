import { describe, expect, it, vi } from 'vitest';

import { QUEUE_TEXT, QUEUE_VERB, queueNotice } from './queueText.ts';

const TITLE = 'Night Bus';

describe('the snackbar after queueing a song', () => {
  it('says which verb happened to a song not yet queued, with Open', () => {
    const openQueue = vi.fn();
    const playNext = queueNotice(QUEUE_VERB.playNext, TITLE, false, openQueue);
    const added = queueNotice(QUEUE_VERB.addToQueue, TITLE, false, openQueue);
    expect(playNext.message).toBe('Night Bus plays next');
    expect(added.message).toBe('Added to queue: Night Bus');
    expect(added.action?.label).toBe(QUEUE_TEXT.open);
    added.action?.onPress();
    expect(openQueue).toHaveBeenCalledOnce();
  });

  it('says where a queued song moved, with no Open', () => {
    const openQueue = vi.fn();
    expect(queueNotice(QUEUE_VERB.playNext, TITLE, true, openQueue)).toEqual({
      message: 'Moved to play next',
    });
    expect(queueNotice(QUEUE_VERB.addToQueue, TITLE, true, openQueue)).toEqual({
      message: 'Moved to end of queue',
    });
  });

  it('offers no Open where no queue sheet can be shown', () => {
    expect(queueNotice(QUEUE_VERB.playNext, TITLE, false, null)).toEqual({
      message: 'Night Bus plays next',
    });
  });
});
