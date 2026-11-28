import { expect, it } from 'vitest';

import { creditLinkText } from './creditLink.ts';
import { BPM_SOURCE_CREDIT } from './tempoLadder/sources.ts';

it.each([
  ['https://getsongbpm.com', 'getsongbpm.com'],
  ['http://example.org/bpm', 'example.org/bpm'],
])('shows %s without its scheme', (url, shown) => {
  expect(creditLinkText({ url })).toBe(shown);
});

it('shows the GetSongBPM credit as its site', () => {
  expect(creditLinkText(BPM_SOURCE_CREDIT.getsongbpm)).toBe('getsongbpm.com');
});
