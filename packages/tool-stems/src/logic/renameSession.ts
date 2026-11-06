export interface RenameEnds {
  readonly save: (name: string) => void;
  readonly cancel: () => void;
}

export interface RenameSession {
  readonly type: (text: string) => void;
  readonly save: () => void;
  readonly cancel: () => void;
  readonly back: () => boolean;
}

export function createRenameSession(
  name: string,
  ends: () => RenameEnds,
): RenameSession {
  let draft = name;
  let open = true;
  const end = (finish: (to: RenameEnds) => void) => {
    if (!open) return;
    open = false;
    finish(ends());
  };
  const cancel = () => {
    end((to) => {
      to.cancel();
    });
  };
  return {
    type: (text) => {
      draft = text;
    },
    save: () => {
      end((to) => {
        to.save(draft);
      });
    },
    cancel,
    back: () => {
      const consumed = open;
      cancel();
      return consumed;
    },
  };
}
