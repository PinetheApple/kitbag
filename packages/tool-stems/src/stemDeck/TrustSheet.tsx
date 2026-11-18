import {
  Button,
  createThemedStyles,
  EditDivider,
  EditRow,
  Sheet,
  SheetHint,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import {
  displayAddress,
  shortFingerprint,
  useStemDeck,
  type StemDeckTrustPrompt,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

const NEW_HINT =
  'This is the first time Kitbag has connected to this computer. StemDeck makes its own certificate, so Android can’t vouch for it. Kitbag remembers it and stops if it ever changes.';
const NOT_RECORDED = 'Not recorded';
const SERVER_NAME = 'StemDeck';
const CANCEL = 'Cancel';

const useStyles = createThemedStyles((theme) => ({
  actions: { flexDirection: 'row', gap: space.controlGap },
  value: { ...textStyle(textRoles.scrubTime), color: theme.color.text },
  changed: { color: theme.color.redInk },
}));

function changedHint(origin: string): string {
  return `${displayAddress(origin)} answered with a different certificate from last time. Reinstalling StemDeck can cause this. So can another device pretending to be it. Kitbag won’t connect unless you trust the new one.`;
}

function Fact({
  label,
  value,
  changed = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly changed?: boolean;
}) {
  const styles = useStyles();
  return (
    <EditRow label={label} singleLine>
      <Text style={[styles.value, changed && styles.changed]}>{value}</Text>
    </EditRow>
  );
}

interface PromptSheetProps<K extends StemDeckTrustPrompt['kind']> {
  readonly prompt: Extract<StemDeckTrustPrompt, { kind: K }> | null;
  readonly bottomInset: number;
  readonly onTrust: () => void;
  readonly onDecline: () => void;
}

function NewServerSheet({
  prompt,
  bottomInset,
  onTrust,
  onDecline,
}: PromptSheetProps<'new'>) {
  const styles = useStyles();
  const version = prompt?.version;
  return (
    <Sheet
      visible={prompt !== null}
      title="Trust this StemDeck?"
      titleSize="large"
      titleIcon="trusted"
      dismissLabel="Close"
      bottomInset={bottomInset}
      onDismiss={onDecline}
    >
      <View>
        <Fact label="Address" value={displayAddress(prompt?.origin ?? '')} />
        <EditDivider />
        <Fact
          label="Server"
          value={
            version === null || version === undefined
              ? SERVER_NAME
              : `${SERVER_NAME} ${version}`
          }
        />
        <EditDivider />
        <Fact
          label="Certificate"
          value={shortFingerprint(prompt?.fingerprint ?? '')}
        />
      </View>
      <SheetHint size="large">{NEW_HINT}</SheetHint>
      <View style={styles.actions}>
        <Button
          fill
          size="target"
          variant="ghost"
          label={CANCEL}
          onPress={onDecline}
        />
        <Button
          fill
          size="target"
          variant="primary"
          label="Trust"
          onPress={onTrust}
        />
      </View>
    </Sheet>
  );
}

function ChangedCertificateSheet({
  prompt,
  bottomInset,
  onTrust,
  onDecline,
}: PromptSheetProps<'changed'>) {
  const styles = useStyles();
  const previous = prompt?.previousFingerprint ?? null;
  return (
    <Sheet
      visible={prompt !== null}
      title="This StemDeck’s certificate changed"
      titleSize="large"
      titleIcon="certificateChanged"
      dismissLabel="Close"
      bottomInset={bottomInset}
      onDismiss={onDecline}
    >
      <SheetHint size="large">{changedHint(prompt?.origin ?? '')}</SheetHint>
      <View>
        <Fact
          label="Last time"
          value={previous === null ? NOT_RECORDED : shortFingerprint(previous)}
        />
        <EditDivider />
        <Fact
          label="Now"
          value={shortFingerprint(prompt?.fingerprint ?? '')}
          changed
        />
      </View>
      <View style={styles.actions}>
        <Button
          fill
          size="target"
          variant="tonal"
          label="Trust new certificate"
          onPress={onTrust}
        />
        <Button
          fill
          size="target"
          variant="primary"
          label="Don’t connect"
          onPress={onDecline}
        />
      </View>
    </Sheet>
  );
}

export function TrustSheet({ bottomInset }: { readonly bottomInset: number }) {
  const connection = useStemDeck((s) => s.connection);
  const trustServer = useStemDeck((s) => s.trustServer);
  const declineTrust = useStemDeck((s) => s.declineTrust);
  const handleTrust = useCallback(() => {
    void trustServer();
  }, [trustServer]);
  const prompt = connection.status === 'trust' ? connection.prompt : null;
  return (
    <>
      <NewServerSheet
        prompt={prompt?.kind === 'new' ? prompt : null}
        bottomInset={bottomInset}
        onTrust={handleTrust}
        onDecline={declineTrust}
      />
      <ChangedCertificateSheet
        prompt={prompt?.kind === 'changed' ? prompt : null}
        bottomInset={bottomInset}
        onTrust={handleTrust}
        onDecline={declineTrust}
      />
    </>
  );
}
