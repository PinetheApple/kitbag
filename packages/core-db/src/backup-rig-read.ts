import type { RouteLatencyRecord } from './backup-format';
import { invalidField, reader } from './backup-reader';
import type { BackupRules } from './backup-rules';

type OffsetBounds = BackupRules['latencyOffsetMs'];

interface RouteViolation {
  field: keyof RouteLatencyRecord;
  reason: string;
}

export function routeViolation(
  { route, offsetMs }: RouteLatencyRecord,
  bounds: OffsetBounds,
): RouteViolation | undefined {
  if (route.trim() === '')
    return { field: 'route', reason: 'expected a route' };
  if (offsetMs < bounds.min || offsetMs > bounds.max)
    return {
      field: 'offsetMs',
      reason: `expected ${String(bounds.min)}–${String(bounds.max)} ms`,
    };
  return undefined;
}

export function routeLatencyReader(bounds: OffsetBounds) {
  return (value: unknown, path: string): RouteLatencyRecord => {
    const r = reader(value, path);
    const record = {
      route: r.string('route'),
      offsetMs: r.number('offsetMs'),
      name: r.nullableString('name'),
      kind: r.nullableString('kind'),
    };
    const violation = routeViolation(record, bounds);
    if (violation) invalidField(`${path}.${violation.field}`, violation.reason);
    return record;
  };
}
