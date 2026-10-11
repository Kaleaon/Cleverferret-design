# Android layout parity and adoption

The original source review used CleverFerret commit
[`ffb910c7`](https://github.com/Kaleaon/CleverFerret/tree/ffb910c76638bcfa0b9041dd7e05cf6561327a4a).
It exposed three modern layout IDs, but the production launcher used the older palette/theme
path. Extending `CFTheme` alone would not have changed the live app.

The design refinements are merged in [PR #22](https://github.com/Kaleaon/Cleverferret-design/pull/22).
The universal standards are merged in [Ktheme PR #111](https://github.com/Kaleaon/Ktheme/pull/111).
Ktheme's version 1 artifact is mirrored at `docs/standards/layouts.v1.json`, and CI verifies
all seven web layouts' corners, type families, surface treatment and LCARS frame geometry
against that exact published artifact.

## Native implementation

Production adoption is prepared in CleverFerret's `codex/universal-layout-standards` branch.
`SettingsRepository` persists the layout independently of the existing palette/dark-mode IDs;
`MainViewModel` supplies it to the launcher and Theme Gallery. Both the live theme and modern
component theme consume the bundled Ktheme contract. Unknown IDs default to Compose; old
`Compose`, `Lcars` and `Metro` names map to `compose`, `sweep` and `tiles`.

| Prototype ID | Native treatment                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| compose      | Material shapes, phone bar → wide rail                                                                 |
| terminal     | JetBrains Mono, consistent 4dp corners, metadata at least 12sp                                         |
| sweep        | Black field, opposing elliptical sweeps, filled text rail, text transport, measured docks              |
| tiles        | Open Sans, square shapes, lowercase pivot navigation, preserved media titles, actions bounded at 160dp |
| glass        | Nunito Sans, soft shapes and opaque text surfaces as the safe glass fallback                           |
| rules        | Jost, persistent rail, sharp corners and quiet surfaces                                                |
| press        | Source Serif 4/Jost, quiet solid actions and shadow-free surfaces                                      |

The native frame derives outer radii 94 × 30dp from rail 76dp, bar 12dp and inner radius 18dp.
Its two inner/outer curve centers are `(94, 86)` and `(94, 150)`, matching the prototype.
The shared scaffold reserves measured player/feedback rows and respects system safe insets.
Shared media corner/elevation tokens extend the selected shapes to routed screens and controls.
The native production palette registry retains 22 existing palettes; the prototype has 26
packs and eight effect packs. Choosing a native sweep pairs it with the user's palette and
is labeled LCARS-inspired. Palette/effect equivalence is not implied by layout parity.

## Validation evidence and limits

The prototype's 20-screen × 7-layout checks, contrast/gradient/glass audits and reviewed
phone/tablet screenshots passed for PR #22. The new contract parity check is part of its unit
validation. Ktheme passed its build and 149 tests across 26 suites.

Six native contract tests passed under JUnit, covering IDs/migration/defaults, portable
requirements, geometry, corners and invalid contracts. Native Detekt passed during this work;
final Android build/test verification is still being completed around dependency downloads
returning HTTP 503. Standalone contract or API compilation checks do not establish that the
full app builds. Native device/emulator screenshots, large text, TalkBack, landscape and
rendered contrast still need review before claiming full visual/accessibility parity.

The native glass fallback keeps text surfaces opaque. Actual wallpaper/backdrop blur needs
a new composition audit. Bundled fonts retain their OFL licenses; Latin subset resources use
Android fallback glyphs for other scripts. Content pictograms, platform status bars and legacy
screen-specific components remain documented deviations from the reference.
