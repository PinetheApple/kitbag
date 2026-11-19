import type { StemDeckConstants } from '@kitbag/core-native';

import type { AddressProblem } from './address.ts';

export type NativeFailure =
  | 'badAddress'
  | 'unreachable'
  | 'timedOut'
  | 'certificateChanged'
  | 'tlsFailed'
  | 'networkOff'
  | 'needsHttps'
  | 'httpNotLocal'
  | 'notFound'
  | 'httpError'
  | 'tooLarge'
  | 'noSpace'
  | 'libraryUnavailable'
  | 'dropped'
  | 'cancelled'
  | 'interrupted'
  | 'timeLimit'
  | 'refused'
  | 'addFailed'
  | 'notAdded';

export type StemDeckFailure =
  | NativeFailure
  | AddressProblem
  | 'notStemDeck'
  | 'trustStale'
  | 'unreadable'
  | 'unknown';

function failureCodes(
  codes: StemDeckConstants,
): ReadonlyMap<string, NativeFailure> {
  const pairs: [string, NativeFailure][] = [
    [codes.failureBadAddress, 'badAddress'],
    [codes.failureUnreachable, 'unreachable'],
    [codes.failureTimedOut, 'timedOut'],
    [codes.failureCertificateChanged, 'certificateChanged'],
    [codes.failureTlsFailed, 'tlsFailed'],
    [codes.failureNetworkOff, 'networkOff'],
    [codes.failureNeedsHttps, 'needsHttps'],
    [codes.failureHttpNotLocal, 'httpNotLocal'],
    [codes.failureNotFound, 'notFound'],
    [codes.failureHttpError, 'httpError'],
    [codes.failureTooLarge, 'tooLarge'],
    [codes.failureNoSpace, 'noSpace'],
    [codes.failureLibraryUnavailable, 'libraryUnavailable'],
    [codes.failureDropped, 'dropped'],
    [codes.failureCancelled, 'cancelled'],
    [codes.failureInterrupted, 'interrupted'],
    [codes.failureTimeLimit, 'timeLimit'],
    [codes.failureRefused, 'refused'],
    [codes.failureAddFailed, 'addFailed'],
    [codes.failureNotAdded, 'notAdded'],
  ];
  return new Map(pairs);
}

export function nativeFailure(
  code: string | null,
  codes: StemDeckConstants,
): StemDeckFailure {
  return (
    (code === null ? undefined : failureCodes(codes).get(code)) ?? 'unknown'
  );
}
