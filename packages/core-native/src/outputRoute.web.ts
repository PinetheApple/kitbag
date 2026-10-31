import type * as Native from './outputRoute.ts';
import type { OutputRoute } from './outputRouteTypes.ts';

const WEB_OUTPUT_ROUTE: OutputRoute = {
  id: 'speaker',
  name: '',
  kind: 'speaker',
  certain: true,
};

export const getOutputRoute: typeof Native.getOutputRoute = () =>
  Promise.resolve(WEB_OUTPUT_ROUTE);

export const watchOutputRoute: typeof Native.watchOutputRoute = () => () =>
  undefined;
