repo: Kaleaon/CleverFerret
branch: main
path: CleverFerret/src/main/java/com/universalmedialibrary/ui

## Last sync

date: 2026-10-11 (app repo at ffb910c7)

### Taken from the app repo this time

- `ui/modern/theme/CFTokens.kt`: E-Ink Monochrome and High Contrast become the **Accessibility**
  colour family (26 packs in total). `CFStatusColors` becomes status tokens and `CFPlayerControls`
  becomes player tokens. Metal brushes are still copied verbatim.
- `ui/modern/theme/CFTheme.kt`: the `cfTypography` scale (display → label) is now a foundation.
- `core/design-system/.../DesignTokensV1.kt`: spacing (`space.0`–`space.16`), radius, motion
  (100/200/320 ms) and contrast targets.
- `services/pipeline/PipelineStage.kt`, `services/metadata/sources/*`,
  `organization/DuplicateDetectionService.kt`, `data/local/entity/UnifiedTag.kt` (`TagType`): the
  cataloging pipeline, metadata agents, duplicate rules and tag provenance used by the
  library-management screens.
- New prototype screens built from existing app screens: Item detail (`detail/ModernDetailScreen.kt`),
  Queue and Video (`player/`), Reading stats (`stats/`), Onboarding (`onboarding/`), Import inbox
  (`imports/`), Fix match (`metadata/`), Tag explorer (`tags/`). File repair and Sort rules are new
  designs on top of `services/epub/*` and `StorageImportPlanBuilder.kt`.

### Drift between the two repos (needs a decision)

Six of the ten packs that exist in both repos have different primary/background pairs. The spec uses the
linkpoint-design values; `CFTokens.kt` uses ktheme JSON values. Only the metal brushes match.

| Pack                              | Spec primary / background | CFTokens.kt primary / background                          |
| --------------------------------- | ------------------------- | --------------------------------------------------------- |
| Navy Gold                         | `#D4AF37` / `#0A1630`     | `#FFD166` / `#0E1D33`                                     |
| Rose Gold                         | `#C1818B` / `#3D1F2B`     | `#E6B0A2` / `#2A0E14`                                     |
| Emerald Silver                    | `#C0C0C0` / `#0D3B2E`     | `#CDD3D6` / `#0A1F18`                                     |
| Midnight Amber                    | `#FFBF00` / `#0C1824`     | `#FFA94D` / `#0A0608`                                     |
| Neo-Noir Neon                     | `#AA43FF` / `#090A10`     | `#FF2EAA` / `#080014`                                     |
| LCARS                             | `#F2A65A` / `#000000`     | `#F2A65A` / `#000000` (aligned; other roles still differ) |
| Metro                             | `#00AEEF` / `#001A33`     | `#00B7C3` / `#000000`                                     |
| Paper & Ink, E-Ink, High Contrast | match                     | match                                                     |

Suggested fix: pick one set as canonical and generate the other from it. `cf-system.js` already
exports everything a generator would need.

### Other decisions recorded here

- **Sweep Console** now uses the canonical LCARS split frame: the header column swoops down into the
  divider bar, and the content bar swoops down into the rail. The v1 overlay of titles and readouts on
  a bar is recorded as a retired deviation. The remaining deviations are listed in the spec under
  "LCARS conformance".
- Contrast correction now runs against every surface a role sits on (background, surface,
  surfaceVariant). Primary used as text gets a lifted `--priText` role.

## Screen map

The screen map is generated from `CF.SCREENS` in `docs/cf-system.js` and published on the landing
page, so it can't fall out of step with the prototype.

## Other sources

- Kaleaon/linkpoint-design (main): docs/react/src/theme/palettes.js, layouts.js, look.js, color.js, components/ConsoleFrame.jsx
- Kaleaon/Ktheme (main): theme-creator/src/index.css (spec-sheet and prototype chrome)
- Kaleaon/calibre_plugins (main): plugin structure and calibre API usage; see `calibre-plugins.md`
- LCARS reference: https://commons.wikimedia.org/wiki/File:Lcars_wallpaper.svg

## Sync history

- 2026-10-11: layout refinement pass. LCARS black field aligned with Android, opposing elbows
  use shared concentric geometry, and playback/feedback have dedicated dock rows. All seven
  layouts received responsive, typography, touch-target and effect contrast review. See
  `layout-refinement-plan.md` and `android-layout-parity.md` for scope and native follow-up.
- 2026-10-11: v2.0. Shared token module and UI kit, 20-screen prototype, library management,
  Accessibility packs, LCARS split frame, spec rebuilt.
- 2026-09-26T14:43:31Z: phone prototype with 9 screens and Theme Studio; Sweep Console LCARS frame.
- 2026-09-26T14:20:07Z: spec sheet built (Home, Library, Player, Reader, Settings, tablet, TV previews).
