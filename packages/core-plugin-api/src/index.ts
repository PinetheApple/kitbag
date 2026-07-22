// core-plugin-api — the abstract plugin contract (SPEC §13.1). Types only.
// This package imports nothing: it is the contract, and nothing a plugin
// carries may enter the core (§9.4).
//
// SKELETON (#27): the real contract — RouteDescriptor (§9.1), the tool
// lifecycle and registration surface — lands with the plugin registry in a
// later Phase 2 wave. This placeholder only exists to anchor the package and
// its (empty) import boundary.

export interface KitbagPlugin {
  /** Stable plugin identifier, unique across registered tools. */
  readonly id: string;
}
