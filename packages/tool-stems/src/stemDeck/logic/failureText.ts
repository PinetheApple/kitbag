import {
  displayAddress,
  type AddressProblem,
  type StemDeckFailure,
} from '@kitbag/core-state';

export type NoticeTone = 'danger' | 'warning';

export interface Notice {
  readonly tone: NoticeTone;
  readonly title: string;
  readonly body: string;
}

export const ADDRESS_EXAMPLE = '192.168.1.50:8443';
export const ADDRESS_PLACEHOLDER = `https://${ADDRESS_EXAMPLE}`;

const NETWORK_SETTING = '“Make StemDeck available on your network”';

type FieldProblem = AddressProblem | 'badAddress';

const NOT_USABLE = `That isn’t an address Kitbag can use. It looks like ${ADDRESS_EXAMPLE}.`;

const ADDRESS_PROBLEMS: Readonly<Record<FieldProblem, string>> = {
  empty: `Type the address StemDeck shows. It looks like ${ADDRESS_EXAMPLE}.`,
  incomplete: `That isn’t a full address. It looks like ${ADDRESS_EXAMPLE}.`,
  invalid: NOT_USABLE,
  badAddress: NOT_USABLE,
  unsupported: 'Kitbag connects to https:// and http:// addresses only.',
};

function isFieldProblem(failure: StemDeckFailure): failure is FieldProblem {
  return failure in ADDRESS_PROBLEMS;
}

export function addressProblemText(failure: StemDeckFailure): string | null {
  return isFieldProblem(failure) ? ADDRESS_PROBLEMS[failure] : null;
}

export const CONNECTION_LOST: ReadonlySet<StemDeckFailure> = new Set([
  'unreachable',
  'timedOut',
  'dropped',
]);

export const CAMERA_UNAVAILABLE: Notice = {
  tone: 'warning',
  title: 'Couldn’t open the camera',
  body: 'Another app may be using it. Close that app and scan again, or type the address below.',
};

export function connectNotice(
  failure: StemDeckFailure,
  origin: string,
): Notice {
  const address = displayAddress(origin);
  if (CONNECTION_LOST.has(failure))
    return {
      tone: 'danger',
      title: 'Can’t reach StemDeck',
      body: `Nothing answered at ${address}. Check that StemDeck is open on the computer, that this phone is on the same Wi-Fi, and that the address matches the one StemDeck shows.`,
    };
  switch (failure) {
    case 'notStemDeck':
    case 'notFound':
      return {
        tone: 'warning',
        title: 'Not a StemDeck server',
        body: `Something answered at ${address}, but it isn’t StemDeck. Check the address in StemDeck’s Settings.`,
      };
    case 'networkOff':
      return {
        tone: 'warning',
        title: 'StemDeck isn’t shared on your network',
        body: `On the computer, open StemDeck’s Settings and turn on ${NETWORK_SETTING}. Then try again.`,
      };
    case 'needsHttps':
      return {
        tone: 'warning',
        title: 'This StemDeck needs a secure address',
        body: 'It only accepts https:// connections. Scan its QR code, or type the https:// address it shows.',
      };
    case 'httpNotLocal':
      return {
        tone: 'warning',
        title: 'This address needs https://',
        body: 'Kitbag uses plain http:// only for computers on your own Wi-Fi. Type the https:// address StemDeck shows.',
      };
    case 'tlsFailed':
      return {
        tone: 'danger',
        title: 'Couldn’t connect securely',
        body: `${address} didn’t finish a secure connection. Check that the address matches the one StemDeck shows.`,
      };
    case 'certificateChanged':
    case 'trustStale':
      return {
        tone: 'warning',
        title: 'This StemDeck’s certificate changed',
        body: 'Connect again to see the new certificate before trusting it.',
      };
    default:
      return {
        tone: 'danger',
        title: 'Something went wrong talking to StemDeck',
        body: 'Try again. If it keeps happening, restart StemDeck on the computer.',
      };
  }
}
