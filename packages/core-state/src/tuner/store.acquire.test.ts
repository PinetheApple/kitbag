import { beforeEach, describe, expect, it } from 'vitest';

import {
  createHarness,
  DROP_D,
  GUITAR,
  settle,
  type Harness,
} from './store.test-helper.ts';

let fakes: Harness['fakes'];
let s: Harness['s'];

beforeEach(() => {
  ({ fakes, s } = createHarness());
});

const RELAUNCHES = 20;

const starts = () => fakes.names().filter((n) => n === 'tunerStart').length;
const stops = () => fakes.names().filter((n) => n === 'tunerStop').length;

describe('acquire', () => {
  it('stays listening when the new screen enters before the old one leaves', async () => {
    const releaseOld = s().acquire(GUITAR);
    await settle();
    s().setTuning(DROP_D);
    s().markTuned(0);

    const releaseNew = s().acquire(GUITAR);
    releaseOld();
    await settle();

    expect(s().open).toBe(true);
    expect(s().mic).toBe('listening');
    expect(s().tuning).toEqual(DROP_D);
    expect(s().tunedStrings).toEqual([0]);
    expect(starts()).toBe(1);
    expect(stops()).toBe(0);

    releaseNew();
    await settle();
    expect(s().open).toBe(false);
    expect(s().mic).toBe('off');
    expect(stops()).toBe(1);
  });

  it('holds through the pause and resume around the handoff, restarting once', async () => {
    const releaseOld = s().acquire(GUITAR);
    await settle();

    fakes.emit('background');
    await settle();
    expect(s().mic).toBe('off');
    expect(stops()).toBe(1);

    const releaseNew = s().acquire(GUITAR);
    releaseOld();
    fakes.emit('active');
    await settle();

    expect(s().mic).toBe('listening');
    expect(starts()).toBe(2);
    expect(fakes.micPermission.request).toHaveBeenCalledTimes(1);

    releaseNew();
    await settle();
    expect(stops()).toBe(2);
    expect(fakes.hasListener()).toBe(false);
  });

  it('is still listening after repeated relaunches, and leaving stops it', async () => {
    let release = s().acquire(GUITAR);
    await settle();
    for (let change = 0; change < RELAUNCHES; change++) {
      fakes.emit('background');
      const next = s().acquire(GUITAR);
      release();
      release = next;
      fakes.emit('active');
      await settle();
      expect(s().mic).toBe('listening');
    }
    release();
    await settle();
    expect(s().mic).toBe('off');
    expect(starts()).toBe(stops());
  });

  it('keeps the mic off when the old screen leaves first while backgrounded', async () => {
    const releaseOld = s().acquire(GUITAR);
    await settle();
    fakes.emit('background');
    await settle();

    releaseOld();
    const releaseNew = s().acquire(GUITAR);
    await settle();

    expect(s().mic).toBe('off');
    expect(starts()).toBe(1);
    expect(stops()).toBe(1);
    expect(fakes.micPermission.request).toHaveBeenCalledTimes(1);

    fakes.emit('active');
    await settle();
    expect(s().mic).toBe('listening');
    expect(starts()).toBe(2);

    releaseNew();
    await settle();
    expect(s().mic).toBe('off');
    expect(stops()).toBe(2);
  });

  it('starts cleanly when the old screen leaves first', async () => {
    const releaseOld = s().acquire(GUITAR);
    await settle();
    releaseOld();
    const releaseNew = s().acquire(GUITAR);
    await settle();

    expect(s().mic).toBe('listening');
    releaseNew();
    await settle();
    expect(s().mic).toBe('off');
  });

  it('stops capture when the only screen leaves, and again after coming back', async () => {
    s().acquire(GUITAR)();
    await settle();
    expect(s().open).toBe(false);
    expect(starts()).toBe(stops());

    const release = s().acquire(GUITAR);
    await settle();
    expect(s().mic).toBe('listening');
    release();
    await settle();
    expect(s().mic).toBe('off');
    expect(starts()).toBe(stops());
  });

  it('ignores a release called twice after the next screen acquired', async () => {
    const releaseOld = s().acquire(GUITAR);
    const releaseNew = s().acquire(GUITAR);
    releaseOld();
    releaseOld();
    await settle();
    expect(s().mic).toBe('listening');
    releaseNew();
    await settle();
    expect(s().open).toBe(false);
  });
});
