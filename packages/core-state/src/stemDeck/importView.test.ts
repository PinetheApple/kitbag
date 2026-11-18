import { describe, expect, it } from 'vitest';

import type { BundleRefusal } from '../songLibrary/stemBundleLogic.ts';
import { importView } from './importView.ts';
import { CODES, item, snapshot } from './store.test-helper.ts';

const NO_SPACE: BundleRefusal = {
  reason: 'noSpace',
  version: 1,
  supportedVersion: 1,
  stemCount: 6,
  maxStems: 16,
  stemFormat: '',
  supportedStemFormat: 'flac',
};

describe('importView', () => {
  it('shows each phase, percent while downloading and skipped songs first', () => {
    const view = importView(
      snapshot([
        item('a', CODES.stateAdded),
        item('b', CODES.stateAdding),
        item('c', CODES.stateDownloading, { bytesDone: 38, bytesTotal: 82 }),
        item('d', CODES.statePreparing),
        item('e', CODES.stateWaiting),
      ]),
      CODES,
      [{ jobId: 'k', title: 'Echo' }],
      new Map(),
    );
    expect(view.rows.map((r) => [r.jobId, r.phase, r.percent])).toEqual([
      ['k', 'skipped', null],
      ['a', 'added', null],
      ['b', 'adding', null],
      ['c', 'downloading', 46],
      ['d', 'preparing', null],
      ['e', 'waiting', null],
    ]);
    expect(view.added).toBe(1);
    expect(view.running).toBe(true);
    expect(view.finished).toBe(false);
  });

  it('reads unknown sizes as unknown, not as negative numbers', () => {
    const [row] = importView(
      snapshot([item('a', CODES.stateDownloading, { bytesDone: 10 })]),
      CODES,
      [],
      new Map(),
    ).rows;
    expect([row?.percent, row?.bytesTotal, row?.bytesFree]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('reports a stopped queue, its failures and what retry would run', () => {
    const view = importView(
      snapshot(
        [
          item('a', CODES.stateAdded),
          item('b', CODES.stateFailed, {
            failure: CODES.failureNoSpace,
            bytesTotal: 82,
            bytesFree: 40,
          }),
          item('c', CODES.stateNotStarted),
        ],
        { running: false, stopReason: CODES.failureNoSpace },
      ),
      CODES,
      [],
      new Map(),
    );
    expect(view.stopped).toBe('noSpace');
    expect(view.retryCount).toBe(2);
    expect(view.finished).toBe(false);
    expect(view.rows[1]).toMatchObject({
      failure: 'noSpace',
      bytesTotal: 82,
      bytesFree: 40,
    });
  });

  it('carries the bundle refusal for a song the library refused', () => {
    const view = importView(
      snapshot(
        [item('a', CODES.stateFailed, { failure: CODES.failureRefused })],
        { running: false },
      ),
      CODES,
      [],
      new Map([['a', NO_SPACE]]),
    );
    expect(view.rows[0]).toMatchObject({
      failure: 'refused',
      refusal: NO_SPACE,
    });
  });

  it('is finished once nothing is left to do', () => {
    const view = importView(
      snapshot([item('a', CODES.stateAdded), item('b', CODES.stateSkipped)], {
        running: false,
      }),
      CODES,
      [],
      new Map(),
    );
    expect(view.finished).toBe(true);
    expect(view.retryCount).toBe(0);
  });
});
