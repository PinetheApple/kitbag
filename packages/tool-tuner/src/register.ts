import type { ToolPlugin } from '@kitbag/core-plugin-api';
import { useTuner } from '@kitbag/core-state';

import { DEFAULT_TUNING, tuningLabel } from './logic/tunings.ts';
import { manifest } from './manifest.ts';
import { TunerScreen } from './screen/TunerScreen.tsx';

export interface TunerPlugin extends ToolPlugin {
  readonly useHomeSubtext: () => string;
}

function useTuningSubtext(): string {
  return tuningLabel(useTuner((s) => s.tuning) ?? DEFAULT_TUNING);
}

export function register(): TunerPlugin {
  const { id, name, icon } = manifest;
  return {
    id,
    name,
    icon,
    routes: [{ path: manifest.routes.home, screen: TunerScreen }],
    useHomeSubtext: useTuningSubtext,
  };
}
