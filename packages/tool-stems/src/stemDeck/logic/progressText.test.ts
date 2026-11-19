import type { StemDeckImportRow, StemDeckImportView } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  addedText,
  finishedText,
  megabytes,
  retryLabel,
  rowBadge,
  rowDetail,
  stopNotice,
} from './progressText.ts';

const MB = 1_000_000;

function row(
  phase: StemDeckImportRow['phase'],
  change: Partial<StemDeckImportRow> = {},
): StemDeckImportRow {
  return {
    jobId: 'a',
    title: 'Way Maker',
    phase,
    failure: null,
    refusal: null,
    percent: null,
    bytesDone: 0,
    bytesTotal: null,
    bytesFree: null,
    ...change,
  };
}

function view(rows: StemDeckImportRow[]): StemDeckImportView {
  return {
    origin: null,
    rows,
    added: rows.filter((r) => r.phase === 'added').length,
    running: false,
    finished: false,
    stopped: null,
    retryCount: 0,
  };
}

describe('a song’s line on the progress screen', () => {
  it('counts stems once it is in', () => {
    expect(rowDetail(row('added'), 6)).toBe('6 stems · in Stem songs');
    expect(rowDetail(row('added'), null)).toBe('In Stem songs');
  });

  it('shows how far a download has got', () => {
    const downloading = row('downloading', {
      bytesDone: 38 * MB,
      bytesTotal: 82 * MB,
    });
    expect(rowDetail(downloading, null)).toBe('Downloading · 38 of 82 MB');
    expect(rowDetail(row('downloading', { bytesDone: 5 * MB }), null)).toBe(
      'Downloading · 5 MB',
    );
  });

  it('says where a lost connection left a song', () => {
    const lost = row('failed', {
      failure: 'dropped',
      bytesDone: 38 * MB,
      bytesTotal: 82 * MB,
    });
    expect(rowDetail(lost, null)).toBe(
      'Connection lost at 46% · nothing added',
    );
  });

  it('badges only the phases the design marks', () => {
    expect(rowBadge(row('adding'))).toEqual({
      label: 'ADDING',
      tone: 'warning',
      icon: 'analyzing',
    });
    expect(rowBadge(row('waiting'))).toBeNull();
  });
});

describe('the progress screen’s counts', () => {
  it('counts what was added out of everything picked', () => {
    expect(addedText(view([row('added'), row('waiting')]))).toBe(
      '1 of 2 added',
    );
  });

  it('words retry and finished counts for one and many', () => {
    expect(retryLabel(1)).toBe('Retry 1 song');
    expect(retryLabel(3)).toBe('Retry 3 songs');
    expect(finishedText(3)).toBe('3 songs are in Stem songs.');
  });

  it('rounds megabytes', () => {
    expect(megabytes(40.4 * MB)).toBe('40');
  });
});

describe('why an import stopped', () => {
  it('says the connection was lost', () => {
    expect(stopNotice(view([]), 'dropped').title).toBe(
      'Lost the connection to StemDeck',
    );
  });

  it('leaves out sizes it does not know', () => {
    expect(
      stopNotice(view([row('failed', { failure: 'noSpace' })]), 'noSpace').body,
    ).toBe('Free some space, then retry.');
  });

  it('asks for the library storage back when it is not mounted', () => {
    expect(stopNotice(view([row('failed')]), 'libraryUnavailable').body).toBe(
      'The library’s storage isn’t available. Reconnect it, then tap Retry.',
    );
  });
});
