export interface Attribution {
  readonly name: string;
  readonly licence: string;
  readonly vendoredAt?: string;
}

export const ATTRIBUTIONS: readonly Attribution[] = [
  { name: 'miniaudio', licence: 'MIT-0', vendoredAt: 'miniaudio.h' },
  { name: 'QM-DSP', licence: 'GPL-2.0-or-later', vendoredAt: 'qm-dsp' },
  {
    name: 'kissfft',
    licence: 'BSD-3-Clause',
    vendoredAt: 'qm-dsp/ext/kissfft',
  },
  { name: 'Space Grotesk', licence: 'OFL-1.1' },
  { name: 'Inter', licence: 'OFL-1.1' },
  { name: 'MaterialCommunityIcons (@expo/vector-icons)', licence: 'MIT' },
];
