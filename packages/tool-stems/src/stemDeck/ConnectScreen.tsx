import { AppBar, Button, SectionHeader } from '@kitbag/core-design';
import {
  stemDeckStore,
  useStemDeck,
  type StemDeckStore,
} from '@kitbag/core-state';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { ScrollView, Text, View, type TextInputInstance } from 'react-native';

import { AddressField } from './AddressField.tsx';
import {
  addressProblemText,
  CAMERA_UNAVAILABLE,
  connectNotice,
} from './logic/failureText.ts';
import { NoticeCard } from './NoticeCard.tsx';
import { RecentServers } from './RecentServers.tsx';
import { SCAN_TITLE, useScanLook } from './scanLook.ts';
import {
  useInset,
  useStemDeckStyles,
  type StemDeckInsets,
} from './stemDeckStyles.ts';
import { TrustSheet } from './TrustSheet.tsx';

const SHARE_HINT =
  'In StemDeck on your computer, open Settings and turn on “Make StemDeck available on your network”. It shows a QR code and an address.';
const PRIVACY = 'Kitbag contacts only the address you give it.';

export interface ConnectScreenProps {
  readonly insets: StemDeckInsets;
  readonly onBack: () => void;
  readonly onConnected: () => void;
  readonly onExplainCamera: () => void;
}

function useAddressFocus(input: RefObject<TextInputInstance | null>) {
  const addressFocus = useStemDeck((s) => s.addressFocus);
  const seen = useRef(addressFocus);
  useEffect(() => {
    if (addressFocus === seen.current) return;
    seen.current = addressFocus;
    input.current?.focus();
  }, [addressFocus, input]);
}

function isReady(state: StemDeckStore): boolean {
  return state.connection.status === 'connected' && state.catalog !== null;
}

function useEntry(onConnected: () => void) {
  const loadRecents = useStemDeck((s) => s.loadRecents);
  const disconnect = useStemDeck((s) => s.disconnect);
  const reopenCatalog = useStemDeck((s) => s.reopenCatalog);
  const ready = useStemDeck(isReady);
  useEffect(() => {
    if (isReady(stemDeckStore.getState())) void reopenCatalog();
    else disconnect();
    void loadRecents();
  }, [disconnect, reopenCatalog, loadRecents]);
  useEffect(() => {
    if (ready && isReady(stemDeckStore.getState())) onConnected();
  }, [ready, onConnected]);
}

function Scan({ onExplainCamera }: { readonly onExplainCamera: () => void }) {
  const hasCamera = useStemDeck((s) => s.codes?.hasCamera === true);
  const unavailable = useStemDeck((s) => s.cameraUnavailable);
  const scanAddress = useStemDeck((s) => s.scanAddress);
  const look = useScanLook();
  const scan = useCallback(() => {
    void scanAddress(look, false).then((answer) => {
      if (answer !== 'granted') onExplainCamera();
    });
  }, [scanAddress, look, onExplainCamera]);
  if (!hasCamera) return null;
  return (
    <>
      <Button
        variant="primary"
        size="target"
        icon="qrScan"
        label={SCAN_TITLE}
        onPress={scan}
      />
      {unavailable ? (
        <NoticeCard
          {...CAMERA_UNAVAILABLE}
          actionLabel="Scan again"
          onAction={scan}
        />
      ) : null}
    </>
  );
}

function ConnectFailure() {
  const connection = useStemDeck((s) => s.connection);
  const connect = useStemDeck((s) => s.connect);
  const failed = connection.status === 'failed' ? connection : null;
  const retry = useCallback(() => {
    if (failed !== null) void connect(failed.address);
  }, [connect, failed]);
  if (failed === null || addressProblemText(failed.failure) !== null)
    return null;
  const notice = connectNotice(failed.failure, failed.address);
  return <NoticeCard {...notice} actionLabel="Try again" onAction={retry} />;
}

function AddressRow({
  input,
}: {
  readonly input: RefObject<TextInputInstance | null>;
}) {
  const styles = useStemDeckStyles();
  const address = useStemDeck((s) => s.address);
  const connection = useStemDeck((s) => s.connection);
  const setAddress = useStemDeck((s) => s.setAddress);
  const connect = useStemDeck((s) => s.connect);
  const busy = connection.status === 'connecting';
  const error =
    connection.status === 'failed'
      ? addressProblemText(connection.failure)
      : null;
  const submit = useCallback(() => {
    void connect(address);
  }, [connect, address]);
  return (
    <View style={styles.actions}>
      <AddressField
        ref={input}
        value={address}
        error={error}
        editable={!busy}
        onChangeText={setAddress}
        onSubmit={submit}
      />
      <Button
        variant="tonal"
        size="target"
        label={busy ? 'Connecting…' : 'Connect'}
        disabled={busy}
        onPress={submit}
      />
    </View>
  );
}

export function ConnectScreen({
  insets,
  onBack,
  onConnected,
  onExplainCamera,
}: ConnectScreenProps) {
  const styles = useStemDeckStyles();
  const connect = useStemDeck((s) => s.connect);
  const input = useRef<TextInputInstance>(null);
  useEntry(onConnected);
  useAddressFocus(input);
  const connectTo = useCallback(
    (origin: string) => {
      void connect(origin);
    },
    [connect],
  );
  const frame = useInset(styles.screen, 'paddingTop', insets.top);
  const content = useInset(styles.body, 'paddingBottom', insets.bottom);
  return (
    <View style={frame}>
      <AppBar flush title="Connect to StemDeck" onBack={onBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={content}
        keyboardShouldPersistTaps="handled"
      >
        <Scan onExplainCamera={onExplainCamera} />
        <Text style={styles.hint}>{SHARE_HINT}</Text>
        <ConnectFailure />
        <SectionHeader label="Or type the address" />
        <AddressRow input={input} />
        <RecentServers bottomInset={insets.bottom} onConnect={connectTo} />
        <View style={styles.spacer} />
        <Text style={styles.footer}>{PRIVACY}</Text>
      </ScrollView>
      <TrustSheet bottomInset={insets.bottom} />
    </View>
  );
}
