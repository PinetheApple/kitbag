// core-plugin-api — the abstract plugin contract (SPEC §9.1, §13.1).
//
// Types only, no runtime. This package imports nothing: no @kitbag/* package,
// no react-native, no React, no native module (§9.1, §9.4). If the contract
// needs one of those, the contract is wrong — that is the whole point of the
// package existing.

/**
 * Icon identifier resolved by the design layer when a tile or route mounts
 * (§9.1). Kept a bare string so the contract does not retype an icon set it
 * does not own (§13.7).
 */
export type IconName = string;

/**
 * A mountable screen, expressed React-agnostically so this package imports no
 * React (§9.1). Any React component is structurally assignable; the shell binds
 * the concrete component type when it aggregates and mounts the tool.
 */
export type PluginScreen = (
  props: Readonly<Record<string, unknown>>,
) => unknown;

/**
 * One route a tool contributes to the file-based router (§9.1, §13.8). The shell
 * registers each descriptor's `path` against its `screen`.
 */
export interface RouteDescriptor {
  readonly path: string;
  readonly screen: PluginScreen;
}

/**
 * The tool's tile on the home screen (§9.1, §9.3): its label and the route
 * opened when tapped.
 */
export interface HomeTileDescriptor {
  readonly label: string;
  readonly route: string;
}

/**
 * Per-tool settings declaration (§9.1, §9.3). SPEC references this by name but
 * does not fix the per-field shape, so it stays an opaque keyed bag rather than
 * invent a settings-field DSL here (§16); a tool that needs concrete fields
 * defines them when SPEC does.
 */
export type SettingsSchema = Readonly<Record<string, unknown>>;

/**
 * A heavy asset a tool downloads on demand (§9.3): its true byte size (tools
 * list their real size), a CDN source, and a checksum the shell verifies before
 * use. No Play Asset Delivery — F-Droid reproducibility (§9.3).
 */
export interface LazyAssetSpec {
  readonly sizeBytes: number;
  readonly url: string;
  readonly checksum: string;
}

/**
 * The plugin contract every tool implements (§9.1). Verbatim to the SPEC §9.1
 * interface — do not add fields it omits or drop fields it lists (§16): a wrong
 * contract propagates into every tool. The Flutter `ToolPlugin` was a sound
 * shape and survives the framework change as this interface.
 */
export interface ToolPlugin {
  readonly id: string;
  readonly name: string;
  readonly icon: IconName;
  readonly routes: readonly RouteDescriptor[];
  readonly homeTile: HomeTileDescriptor;
  readonly settingsSchema?: SettingsSchema;
  readonly assets?: LazyAssetSpec;
}
