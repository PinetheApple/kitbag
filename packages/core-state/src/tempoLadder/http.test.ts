import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getJson,
  LOOKUP_TIMEOUT_MS,
  withTimeout,
  type HttpGet,
} from './http.ts';

afterEach(() => {
  vi.useRealTimers();
});

const SIGNAL = new AbortController().signal;
const TEST_URL = 'https://example.test';

describe('getJson', () => {
  it('reads the body of a good response', async () => {
    const httpGet: HttpGet = () =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ a: 1 }) });
    expect(await getJson(httpGet, TEST_URL, SIGNAL)).toEqual({ a: 1 });
  });

  it('fails on an error status', async () => {
    const httpGet: HttpGet = () =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    await expect(getJson(httpGet, TEST_URL, SIGNAL)).rejects.toThrow();
  });

  it('keeps the request address, and the key in it, out of the error', async () => {
    const httpGet: HttpGet = () =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    const failure = getJson(httpGet, `${TEST_URL}?api_key=test-key`, SIGNAL);
    await expect(failure).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining('test-key') as unknown,
      }),
    );
  });

  it('passes the signal to the request', async () => {
    const seen: AbortSignal[] = [];
    const httpGet: HttpGet = (_url, { signal }) => {
      seen.push(signal);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
    };
    await getJson(httpGet, TEST_URL, SIGNAL);
    expect(seen).toEqual([SIGNAL]);
  });
});

describe('withTimeout', () => {
  it('gives up on work that ignores the abort, and aborts it', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const pending = withTimeout((signal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<never>(() => undefined);
    });
    const outcome = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(LOOKUP_TIMEOUT_MS);
    await outcome;
    expect(aborted).toBe(true);
  });

  it('waits out slow work inside the time limit', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => {
            resolve('late');
          }, LOOKUP_TIMEOUT_MS - 1);
        }),
    );
    await vi.advanceTimersByTimeAsync(LOOKUP_TIMEOUT_MS - 1);
    expect(await pending).toBe('late');
  });
});
