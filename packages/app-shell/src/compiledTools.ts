import { register as registerStems } from '@kitbag/tool-stems';
import { register as registerSync } from '@kitbag/tool-sync';
import { register as registerTuner } from '@kitbag/tool-tuner';

import { listening } from '@/listening/listening';
import { toolHost } from '@/toolHost/toolHost';

const host = { ...toolHost, listening };

export const compiledTools = {
  stems: registerStems(host),
  sync: registerSync(),
  tuner: registerTuner(),
};

export type CompiledTools = typeof compiledTools;
