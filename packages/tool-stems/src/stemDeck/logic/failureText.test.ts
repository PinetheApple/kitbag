import { describe, expect, it } from 'vitest';

import { addressProblemText, connectNotice } from './failureText.ts';

const ORIGIN = 'https://192.168.1.50:8443';

describe('a connect that fails', () => {
  it('says nothing answered, with the address', () => {
    expect(connectNotice('unreachable', ORIGIN)).toEqual({
      tone: 'danger',
      title: 'Can’t reach StemDeck',
      body: 'Nothing answered at 192.168.1.50:8443. Check that StemDeck is open on the computer, that this phone is on the same Wi-Fi, and that the address matches the one StemDeck shows.',
    });
  });

  it('treats a timeout as nothing answering', () => {
    expect(connectNotice('timedOut', ORIGIN).title).toBe(
      'Can’t reach StemDeck',
    );
  });

  it('warns about a server that is not StemDeck', () => {
    expect(connectNotice('notStemDeck', 'https://192.168.1.1:443')).toEqual({
      tone: 'warning',
      title: 'Not a StemDeck server',
      body: 'Something answered at 192.168.1.1:443, but it isn’t StemDeck. Check the address in StemDeck’s Settings.',
    });
  });

  it('says how to share StemDeck on the network', () => {
    expect(connectNotice('networkOff', ORIGIN)).toEqual({
      tone: 'warning',
      title: 'StemDeck isn’t shared on your network',
      body: 'On the computer, open StemDeck’s Settings and turn on “Make StemDeck available on your network”. Then try again.',
    });
  });

  it('asks for the secure address when server mode refuses http', () => {
    expect(connectNotice('needsHttps', 'http://192.168.1.50:8000')).toEqual({
      tone: 'warning',
      title: 'This StemDeck needs a secure address',
      body: 'It only accepts https:// connections. Scan its QR code, or type the https:// address it shows.',
    });
  });

  it('falls back to a general notice for anything else', () => {
    expect(connectNotice('unknown', ORIGIN).tone).toBe('danger');
  });
});

describe('an address that cannot be used', () => {
  it('shows an incomplete address under the field, with an example', () => {
    expect(addressProblemText('incomplete')).toBe(
      'That isn’t a full address. It looks like 192.168.1.50:8443.',
    );
  });

  it('shows an address native refused under the field too', () => {
    expect(addressProblemText('badAddress')).toBe(
      'That isn’t an address Kitbag can use. It looks like 192.168.1.50:8443.',
    );
  });

  it('leaves connection failures to the notice card', () => {
    expect(addressProblemText('unreachable')).toBeNull();
  });
});
