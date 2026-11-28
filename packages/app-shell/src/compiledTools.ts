import { polyRatioLabel } from '@kitbag/core-state';
import { countInLabel, useCustomSoundViews } from '@kitbag/tool-metronome';
import { register as registerStems } from '@kitbag/tool-stems';
import { register as registerSync } from '@kitbag/tool-sync';
import { register as registerTuner } from '@kitbag/tool-tuner';

import { listening } from '@/listening/listening';
import { toolHost } from '@/toolHost/toolHost';

const metronome = { countInLabel, polyRatioLabel, useCustomSoundViews };

const host = { ...toolHost, listening, metronome };

export const compiledTools = {
  host,
  stems: registerStems(host),
  sync: registerSync(),
  tuner: registerTuner(),
};

export type CompiledTools = typeof compiledTools;
