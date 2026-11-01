import type { OutputRoute, OutputRouteKind } from '@kitbag/core-native';
import type { RouteLatency } from '@kitbag/core-db';

import { isOutputRouteKind } from './routeLabel.ts';

const OTHER_KIND: OutputRouteKind = 'other';

export function storedRoute(row: RouteLatency): OutputRoute {
  const kind = row.kind ?? OTHER_KIND;
  return {
    id: row.route,
    name: row.name ?? '',
    kind: isOutputRouteKind(kind) ? kind : OTHER_KIND,
    certain: true,
  };
}
