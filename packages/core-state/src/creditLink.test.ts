import { expect, it } from 'vitest';

import { creditLinkText } from './creditLink.ts';

const CREDIT = { name: 'Example BPM', url: 'https://bpm.example.com' };

it.each([
  ['https://getsongbpm.com', 'getsongbpm.com'],
  ['http://example.org/bpm', 'example.org/bpm'],
])('shows %s without its scheme', (url, shown) => {
  expect(creditLinkText({ url })).toBe(shown);
});

it('shows a credit as its site', () => {
  expect(creditLinkText(CREDIT)).toBe('bpm.example.com');
});
