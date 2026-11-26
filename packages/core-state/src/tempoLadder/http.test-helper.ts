import type { HttpGet } from './http.ts';

export const GETSONGBPM_SEARCH = 'api.getsong.co/search';

export function fakeHttp(bodies: Readonly<Record<string, unknown>>) {
  const urls: string[] = [];
  const httpGet: HttpGet = (url) => {
    urls.push(url);
    const route = Object.keys(bodies).find((part) => url.includes(part));
    if (route === undefined) {
      return Promise.reject(new Error(`No fake response for ${url}`));
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(bodies[route]),
    });
  };
  return { httpGet, urls };
}

export const offline: HttpGet = () => Promise.reject(new Error('offline'));
