import {
  createThemedStyles,
  size,
  textRoles,
  textStyle,
  useKeyboardDidHide,
  useTheme,
} from '@kitbag/core-design';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { BackHandler, TextInput } from 'react-native';

import {
  createRenameSession,
  type RenameEnds,
} from '../logic/renameSession.ts';

const useStyles = createThemedStyles((theme) => ({
  input: {
    ...textStyle(textRoles.stemName),
    color: theme.color.text,
    flex: 1,
    padding: 0,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.accentDim,
  },
}));

interface StemNameEditorProps {
  readonly name: string;
  readonly onDone: (name: string) => void;
  readonly onCancel: () => void;
}

export function StemNameEditor({
  name,
  onDone,
  onCancel,
}: StemNameEditorProps) {
  const styles = useStyles();
  const theme = useTheme();
  const [draft, setDraft] = useState(name);
  const ends = useRef<RenameEnds>({ save: onDone, cancel: onCancel });
  useEffect(() => {
    ends.current = { save: onDone, cancel: onCancel };
  });
  const [session] = useState(() =>
    createRenameSession(name, () => ends.current),
  );
  const change = useCallback(
    (text: string) => {
      session.type(text);
      setDraft(text);
    },
    [session],
  );
  // Back with the keyboard up reaches the IME, not BackHandler, and leaves the
  // input focused: a keyboard hide without a blur is that Back.
  useKeyboardDidHide(session.cancel);
  useEffect(() => {
    const back = BackHandler.addEventListener(
      'hardwareBackPress',
      session.back,
    );
    return () => {
      back.remove();
    };
  }, [session]);
  // A layout cleanup runs before the screen's passive close(), so leaving the
  // player mid-edit still stores the name against the session it was typed in.
  useLayoutEffect(() => session.save, [session]);
  return (
    <TextInput
      style={styles.input}
      value={draft}
      onChangeText={change}
      onBlur={session.save}
      placeholder={name}
      placeholderTextColor={theme.color.text3}
      accessibilityLabel={`New name for ${name}`}
      returnKeyType="done"
      autoFocus
      selectTextOnFocus
    />
  );
}
