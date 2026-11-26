export const LOOKUP_TIMEOUT_MS = 5000;

export interface HttpResponse {
  readonly ok: boolean;
  readonly json: () => Promise<unknown>;
}

export type HttpGet = (
  url: string,
  init: { readonly signal: AbortSignal },
) => Promise<HttpResponse>;

export async function getJson(
  httpGet: HttpGet,
  url: string,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await httpGet(url, { signal });
  if (!response.ok) throw new Error(`Lookup failed: ${url}`);
  return response.json();
}

export async function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Lookup timed out'));
    }, LOOKUP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work(controller.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}
