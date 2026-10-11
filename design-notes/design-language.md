# CleverFerret design language

How CleverFerret looks and behaves, and where each part lives in code. The values are in
`docs/cf-system.js`; components are in `docs/cf-ui.css`; the spec page renders both.

## Principles

1. **Three independent layers.** A theme is a layout pack × a colour pack × an effect pack
   (7 × 26 × 8 = 1,456). A layout never locks a palette; a palette never chooses navigation.
2. **Metal is the signature.** Each pack has one reference four-stop brush (shadow 0, base .45,
   highlight .85, shimmer 1). UI text and CTA brushes are corrected separately so labels remain
   legible throughout the gradient. Flat LCARS omits effects; Press uses a quiet solid CTA.
3. **Content wins in media modes.** Reader, player and video set their own chrome density. The
   reader canvas never gets pattern, grain or glow; video keeps only the progress and focus accent.
4. **Catalogue like Calibre, file like Plex.** New media is matched (confidence-gated), repaired
   (reversibly), renamed to a server-ready path and tagged with provenance.
5. **Accessible by default.** Every pack is corrected to WCAG 2.2 AA against every surface it sits
   on. Status is never shown by colour alone. Motion follows the system. E-Ink and High Contrast packs
   lock the effects that would hurt them.
6. **Honest about references.** A pack that quotes a canon, like Sweep Console and LCARS, lists
   where it deviates and why.

## Foundations

| Scale | Values | Kotlin source |
| --- | --- | --- |
| Type | Display L 44/52 … Label S 10/14 (13 roles) | `CFTheme.kt` `cfTypography` |
| Spacing | 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64; frame gaps LCARS 4, Metro grid 10 | `DesignTokensV1.SPACING_DP`, `CFSpacing` |
| Radius | core s4 m8 l12 xl16 full; each layout pack overrides seven radii | `DesignTokensV1.RADIUS_DP` |
| Motion | fast 100, normal 200, slow 320 ms; shimmer 2.8 s, pulse 2.4 s | `DesignTokensV1.MOTION_DURATION` |
| Contrast | body 4.5, large 3, UI 3, focus 3, AAA 7 | `DesignTokensV1.CONTRAST_TARGETS` |

## Colour roles beyond MD3

- `--priText`: primary lifted to 4.5:1 on background, surface and surfaceVariant, for primary-coloured
  labels, links and counts.
- Status tokens (`CFStatusColors`): completed, ongoing, hiatus, cancelled, downloading, outdated,
  failed, neutral. Always paired with an icon and a label.
- Player tokens (`CFPlayerControls`): derived from the pack roles.
- Reader pages: Day, Sepia and Night, tinted by the pack.

## Patterns

| Pattern | Where | Notes |
| --- | --- | --- |
| Section header | every list | LCARS packs render cap → title → bar → end cap; others a plain title |
| Metal CTA | Resume, Apply, File all | one per screen; pulses only with Architect or Prism |
| Tonal action (`lm-act`) | inbox rows, library manager | secondary actions that still need weight |
| Pipeline strip | Import inbox | Scan → Normalize → Match → Repair → File; the next stage with work left is highlighted |
| Confidence badge | inbox, Fix match | ≥90 files automatically, 60–89 waits for review, <60 is never applied without asking |
| Field diff | Fix match | checkbox per field; unticked fields keep their current value |
| Issue switch row | File repair | severity icon, problem, fix, before → after; originals are kept for 30 days |
| Path template | Sort rules | tokens shown as chips; Calibre layout for books, Plex/Jellyfin for video and music |
| Hierarchical tag | Tag explorer, detail | `Parent › Child` breadcrumb, count and source icon (You, Auto, Calibre, Plex, Jellyfin) |
| Manifest form | Calibre plugins | switch, text, secret, segmented, chips; replaces Qt dialogs |
| Empty, loading, error | everywhere | `cf-empty`, `cf-skel` (shimmer follows motion), failed status with Retry |
| Live region | toasts | one persistent `role="status"` region, not one mounted per toast |

## Layout packs at a glance

| Pack | Navigation | Character |
| --- | --- | --- |
| Compose | bar → rail | MD3, pill CTAs (default) |
| Ink Terminal | tabs → rail | mono, boxed, tracked caps |
| Sweep Console | LCARS split frame | elbows, segmented rail, Antonio; see the spec's LCARS conformance section |
| Metro Tiles | pivot + app bar | zero radius, lowercase pivots, accent tiles |
| Aero Glass | tabs → rail | soft glossy panels |
| Rule & Rail | side rail | hairlines, sharp corners, 0.3em tracking |
| Press | tabs → rail | editorial serif, quiet rows |

Compose, Ink Terminal, Aero Glass and Press switch from a bottom bar to a 72px rail at a
720px prototype width, including a live resize. Metro keeps lowercase navigation while preserving
media title case; quick-action heights are bounded at 160px on wide screens. Ink Terminal uses
4px corners throughout and at least 12px metadata. Rule & Rail reduces tracking on media titles
and scales the hero title to its container so words do not split needlessly.

Interactive controls have at least 48 × 48 CSS pixel targets. Scrollable filter and pivot strips
remain horizontally scrollable. Aero Glass text is checked against the background washes and
composited panel, navigation and player surfaces; gradient tests sample between stops as well.

### Sweep Console reference

The reference is Sweep Console × LCARS Amber × Flat. Other effect selections are labeled
LCARS-inspired. LCARS Amber uses a black field, matching the native background and primary roles.
Content pictograms and the platform status bar remain documented deviations.

`CF.LCARS.frame` owns rail 76, bar 12, gap 4 and inner radius 18. The outer sweep is an ellipse
with radii 94 × 30 (rail + inner, bar + inner); this puts the inner and outer curve centers at
the same coordinates for both opposing elbows. Frame and content positioning use derived values
from `CF.lcarsGeometry()`, rather than unrelated offsets. This is the prototype's geometry
convention, not a claim of an official pixel specification for every LCARS screen.

Readouts sit unboxed in the black field. Filters and segmented controls use filled segments,
and playback uses text-led rectangular controls. Player and feedback rows are part of the
console grid, leaving the scrollable content unobscured.

## Moving this into the app

1. Generate `CFTokens.kt` palettes from `cf-system.js`, or the reverse, once the palette drift in
   `sync-log.md` is settled.
2. Replace `CleverFerretTheme` (22 enums), `MediaThemes` and `CFLayout` with the three-ID theme JSON
   shown on the spec page.
3. Add `priText`, status and player tokens to `CFTokens`.
4. Build the library-management screens on the existing pipeline and tagging services.

See [Android layout parity](android-layout-parity.md) for the source-reviewed native gaps and
an implementation order covering every layout.
