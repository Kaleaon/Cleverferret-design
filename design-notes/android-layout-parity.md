# Android layout parity review

Reviewed [Kaleaon/CleverFerret at ffb910c7](https://github.com/Kaleaon/CleverFerret/tree/ffb910c76638bcfa0b9041dd7e05cf6561327a4a).
This is a source review of `ui/modern`, not an emulator validation or a native implementation.
The design prototype now has the refinements; native adoption needs the work below.

## Source evidence

- [`theme/CFTokens.kt`](https://github.com/Kaleaon/CleverFerret/blob/ffb910c76638bcfa0b9041dd7e05cf6561327a4a/CleverFerret/src/main/java/com/universalmedialibrary/ui/modern/theme/CFTokens.kt)
  exposes only `CFLayout { Compose, Lcars, Metro }`. Palettes choose a layout, while the prototype
  stores layout, palette and effect independently. Native LCARS primary/background already match
  the corrected prototype; full palette roles still need reconciliation (see `sync-log.md`).
- [`theme/CFTheme.kt`](https://github.com/Kaleaon/CleverFerret/blob/ffb910c76638bcfa0b9041dd7e05cf6561327a4a/CleverFerret/src/main/java/com/universalmedialibrary/ui/modern/theme/CFTheme.kt)
  supplies Material colors and typography. It does not construct the opposing LCARS frame.
- [`components/Scaffolding.kt`](https://github.com/Kaleaon/CleverFerret/blob/ffb910c76638bcfa0b9041dd7e05cf6561327a4a/CleverFerret/src/main/java/com/universalmedialibrary/ui/modern/components/Scaffolding.kt)
  uses a generic Material top bar, a circular metal button, outlined circular chips and fixed
  rounded settings rows. Those components need layout dispatch for a flat LCARS design or Press.
- [`components/SharedComponents.kt`](https://github.com/Kaleaon/CleverFerret/blob/ffb910c76638bcfa0b9041dd7e05cf6561327a4a/CleverFerret/src/main/java/com/universalmedialibrary/ui/modern/components/SharedComponents.kt)
  fixes cover rounding at 6dp and mini-player rounding at 14dp. The player is a floating card;
  its Previous/Play icons have null content descriptions. Layout tokens and named actions are needed.
- [`components/MetroTileGrid.kt`](https://github.com/Kaleaon/CleverFerret/blob/ffb910c76638bcfa0b9041dd7e05cf6561327a4a/CleverFerret/src/main/java/com/universalmedialibrary/ui/modern/components/MetroTileGrid.kt)
  already uses an adaptive minimum-width grid and spacing tokens. Check actual tile aspect/height
  at screen call sites before adding a maximum; the grid alone does not establish those dimensions.

## Native implementation sequence

1. Introduce independent persisted layout/palette/effect IDs with migration from existing themes.
   Preserve old IDs and map `Lcars` → `sweep`, `Metro` → `tiles`, `Compose` → `compose`.
   Add the four missing layout IDs without making palette selection overwrite layout.
2. Add typed layout tokens for shapes, label/content casing, typography, borders, action treatment
   and navigation. Keep reference metal stops separate from accessible text/CTA brushes.
   Settle remaining palette drift, then generate shared data with a parity check.
3. Build a layout-aware scaffold and shared components. Draw LCARS curves from the common geometry;
   reserve player and Snackbar rows, respect safe insets, and keep content scrollable. Use the same
   semantics for actions regardless of their visual treatment.
4. Apply layout dispatch to modern screen call sites, including home, library, detail, themes,
   settings, import/metadata screens and player. A theme token alone will not change their structure.
5. Validate phone/tablet, landscape, large text, TalkBack, reduced motion and dynamic media titles.

| Prototype ID | Native starting point | Required treatment |
| --- | --- | --- |
| compose | `Compose` | Adaptive bar/rail, existing MD3 shapes |
| terminal | Missing ID | Mono type, 4dp corners, boxed rows, readable metadata |
| sweep | `Lcars` colors | Opposing frame, black field, filled segments, text transport, player/feedback docks |
| tiles | `Metro`, adaptive grid | Lowercase navigation only; bounded wide tiles and square surfaces |
| glass | Missing ID | Soft panels; contrast over actual composited backgrounds |
| rules | Missing ID | Persistent rail, hairlines, sharp shapes, word-safe title wrapping |
| press | Missing ID | Serif content, quiet rules/actions, minimal player shadow |

## Native acceptance gates

- Every layout changes component structure/treatment as specified, independently of palette.
- Shared targets are at least 48dp, with accessible names for playback and icon actions.
- LCARS curves share centers; readouts remain in black space and docks never obscure content.
- Titles fit at large font scales without forced mid-word breaks; navigation remains reachable.
- Contrast is checked on rendered surfaces and gradient samples, including glass backdrops.
- Follow the app's `AGENTS.md`: `./gradlew detekt`, `./gradlew testDebugUnitTest` and
  `./gradlew assembleDebug` before opening/updating an Android implementation PR. Keep complexity
  and magic-number rules active; name geometry tokens instead of embedding numbers in composables.
