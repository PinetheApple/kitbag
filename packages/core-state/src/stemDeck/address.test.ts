import { describe, expect, it } from 'vitest';

import { displayAddress, parseAddress, shortFingerprint } from './address.ts';

describe('parseAddress', () => {
  it.each([
    ['192.168.1.50:8443', 'https://192.168.1.50:8443', true],
    ['https://192.168.1.50:8443', 'https://192.168.1.50:8443', true],
    ['https://studio.local', 'https://studio.local:443', true],
    ['  HTTP://10.0.0.12:8000/ ', 'http://10.0.0.12:8000', false],
    ['http://Studio.Local', 'http://studio.local:80', false],
    ['[fe80::1]:8443', 'https://[fe80::1]:8443', true],
    ['http://192.168.0.100:8000/mobile/', 'http://192.168.0.100:8000', false],
    ['https://studio.local:8443/mobile', 'https://studio.local:8443', true],
    ['192.168.1.50/api/jobs', 'https://192.168.1.50:443', true],
  ])('reads %s as %s', (text, origin, secure) => {
    expect(parseAddress(text)).toEqual({ ok: true, origin, secure });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['192.168.1', 'incomplete'],
    ['192.168.1.', 'incomplete'],
    ['192.168.1.50:', 'incomplete'],
    ['ftp://192.168.1.50', 'unsupported'],
    ['192.168.1.256', 'invalid'],
    ['192.168.1.50.7', 'invalid'],
    ['192.168.1.50:70000', 'invalid'],
    ['192.168.1.50:0', 'invalid'],
    ['http://192.168.0.100:8000/mobile/?k=1', 'invalid'],
    ['http://192.168.0.100:8000/mobile/#top', 'invalid'],
    ['192.168.0.100:8000?k=1', 'invalid'],
    ['192.168.0.100#top', 'invalid'],
    ['stem deck', 'invalid'],
  ])('refuses %j as %s', (text, problem) => {
    expect(parseAddress(text)).toEqual({ ok: false, problem });
  });
});

describe('displayAddress', () => {
  it('drops https:// and keeps http:// so plain addresses stand out', () => {
    expect(displayAddress('https://192.168.1.50:8443')).toBe(
      '192.168.1.50:8443',
    );
    expect(displayAddress('http://10.0.0.12:8000')).toBe(
      'http://10.0.0.12:8000',
    );
  });
});

describe('shortFingerprint', () => {
  it('shows the first 8 bytes in four groups', () => {
    expect(shortFingerprint('4f2a91c07be355d8'.padEnd(64, 'e'))).toBe(
      '4F2A 91C0 7BE3 55D8',
    );
  });
});
