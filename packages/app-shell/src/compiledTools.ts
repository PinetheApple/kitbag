import { register as registerStems } from '@kitbag/tool-stems';

import { listening } from '@/listening/listening';
import { toolHost } from '@/toolHost/toolHost';

const host = { ...toolHost, listening };

export const compiledTools = {
  stems: registerStems(host),
};
