import { expect, it, vi } from 'vitest';

import { getOutputRoute, watchOutputRoute } from './outputRoute.web.ts';

it('reports the same certain speaker route on every call', async () => {
  const first = await getOutputRoute();
  expect(first).toEqual({
    id: 'speaker',
    name: '',
    kind: 'speaker',
    certain: true,
  });
  expect(await getOutputRoute()).toEqual(first);
});

it('never reports a change and unsubscribes cleanly', async () => {
  const seen = vi.fn();
  const unsubscribe = watchOutputRoute(seen);
  await new Promise((resolve) => setTimeout(resolve, 0));
  unsubscribe();
  expect(seen).not.toHaveBeenCalled();
});
