// VS15 asks for text presentation; without it Android draws these as colour
// emoji that ignore the token colour.
const TEXT_PRESENTATION = '︎';

const text = (glyph: string) => `${glyph}${TEXT_PRESENTATION}`;

export const icons = {
  back: '‹',
  more: '⋮',
  settings: text('⚙'),
  sort: '⇅',
  caretDown: '⌄',
  caretUp: '⌃',
  practice: '◴',
  reset: '↺',
  repeat: '↻',
  setlist: '≡',
  previous: text('⏮'),
  next: text('⏭'),
  backspace: '⌫',
  confirm: '✓',
  success: '✓',
  failure: '✗',
  warning: text('⚠'),
  ramp: text('⛰'),
  muteBars: '▨',
  sound: '♩',
  countIn: text('⏱'),
  decrease: '−',
  increase: '+',
} as const;

export type IconName = keyof typeof icons;

export const emojiCapableIcons: readonly IconName[] = [
  'settings',
  'previous',
  'next',
  'warning',
  'ramp',
  'countIn',
];
