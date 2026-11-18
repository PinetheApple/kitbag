import {
  Button,
  hitBoxStyle,
  hitExtension,
  Icon,
  libraryList,
  minTouchTargetDp,
  SectionHeader,
  Sheet,
  SheetHint,
  unshared,
  createThemedStyles,
  EllipsizedText,
  space,
} from '@kitbag/core-design';
import {
  displayAddress,
  useStemDeck,
  type StemDeckRecentServer,
} from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { recentSubtitle } from './logic/songFacts.ts';
import { useStemDeckStyles } from './stemDeckStyles.ts';

const MORE_HIT_BOX = hitBoxStyle(
  hitExtension(libraryList.moreWidth, minTouchTargetDp, {
    left: libraryList.rowGap,
    right: unshared(libraryList.rowEnd),
  }),
);

const useStyles = createThemedStyles(() => ({
  more: {
    ...MORE_HIT_BOX,
    width: libraryList.moreWidth,
    height: minTouchTargetDp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: space.controlGap },
}));

interface ServerRowProps {
  readonly server: StemDeckRecentServer;
  readonly now: number;
  readonly onConnect: (origin: string) => void;
  readonly onMenu: (server: StemDeckRecentServer) => void;
}

function ServerRow({ server, now, onConnect, onMenu }: ServerRowProps) {
  const shared = useStemDeckStyles();
  const styles = useStyles();
  const address = displayAddress(server.origin);
  const subtitle = recentSubtitle(server.trust, server.lastUsedAt, now);
  const connect = useCallback(() => {
    onConnect(server.origin);
  }, [onConnect, server.origin]);
  const openMenu = useCallback(() => {
    onMenu(server);
  }, [onMenu, server]);
  return (
    <View style={shared.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Connect to ${address}, ${subtitle}`}
        style={shared.rowBody}
        onPress={connect}
        onLongPress={openMenu}
      >
        <View style={shared.tile}>
          <Icon
            name={server.trust === 'plain' ? 'stemDeckServer' : 'trusted'}
            size="listTile"
          />
        </View>
        <View style={shared.text}>
          <EllipsizedText style={shared.title}>{address}</EllipsizedText>
          <EllipsizedText style={shared.facts}>{subtitle}</EllipsizedText>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${address}`}
        style={styles.more}
        onPress={openMenu}
      >
        <Icon name="more" size="bar" />
      </Pressable>
    </View>
  );
}

interface ForgetSheetProps {
  readonly server: StemDeckRecentServer | null;
  readonly bottomInset: number;
  readonly onClose: () => void;
}

function ForgetSheet({ server, bottomInset, onClose }: ForgetSheetProps) {
  const styles = useStyles();
  const forgetServer = useStemDeck((s) => s.forgetServer);
  const forget = useCallback(() => {
    if (server !== null) void forgetServer(server.origin);
    onClose();
  }, [forgetServer, onClose, server]);
  return (
    <Sheet
      visible={server !== null}
      title={displayAddress(server?.origin ?? '')}
      titleSize="large"
      dismissLabel="Keep this StemDeck"
      bottomInset={bottomInset}
      onDismiss={onClose}
    >
      <SheetHint size="large">
        Forgetting drops this address from Recent and the certificate Kitbag
        remembered for it.
      </SheetHint>
      <View style={styles.actions}>
        <Button
          fill
          size="target"
          variant="ghost"
          label="Cancel"
          onPress={onClose}
        />
        <Button
          fill
          size="target"
          variant="destructive"
          label="Forget"
          onPress={forget}
        />
      </View>
    </Sheet>
  );
}

export interface RecentServersProps {
  readonly bottomInset: number;
  readonly onConnect: (origin: string) => void;
}

export function RecentServers({ bottomInset, onConnect }: RecentServersProps) {
  const shared = useStemDeckStyles();
  const recents = useStemDeck((s) => s.recents);
  const [menu, setMenu] = useState<StemDeckRecentServer | null>(null);
  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);
  const now = Date.now();
  if (recents.length === 0) return null;
  return (
    <>
      <SectionHeader label="Recent" />
      <View style={shared.list}>
        {recents.map((server) => (
          <ServerRow
            key={server.origin}
            server={server}
            now={now}
            onConnect={onConnect}
            onMenu={setMenu}
          />
        ))}
      </View>
      <ForgetSheet
        server={menu}
        bottomInset={bottomInset}
        onClose={closeMenu}
      />
    </>
  );
}
