// An empty Text carries no fragment, so RN's text measure cache key loses the
// font scale and replays the old height after a text-size change (#202).
export const TEXT_PLACEHOLDER = '\u00A0';
