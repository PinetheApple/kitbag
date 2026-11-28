import { manifest as library } from '@kitbag/tool-library/manifest';
import { manifest as stems } from '@kitbag/tool-stems/manifest';
import { manifest as sync } from '@kitbag/tool-sync/manifest';
import { manifest as tuner } from '@kitbag/tool-tuner/manifest';

export const TOOL_MANIFESTS = { library, stems, sync, tuner } as const;
