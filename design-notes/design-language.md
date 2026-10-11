# CleverFerret design language

How CleverFerret looks and behaves, and where each part lives in code. The values are in
`docs/cf-system.js`; components are in `docs/cf-ui.css`; the spec page renders both.

## Principles

1. **Three independent layers.** A theme is a layout pack × a colour pack × an effect pack
   (7 × 26 × 8 = 1,456). A layout never locks a palette; a palette never chooses navigation.
2. **Metal is the signature.** Each pack has one four-stop brush (shadow 0, base .45, highlight .85,
   shimmer 1). It appears only on the wordmark, primary CTAs, chips and the active progress fill.
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
| Spacing | 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64; gutters LCARS 6, Metro 10 | `DesignTokensV1.SPACING_DP`, `CFSpacing` |
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

## Moving this into the app

1. Generate `CFTokens.kt` palettes from `cf-system.js`, or the reverse, once the palette drift in
   `sync-log.md` is settled.
2. Replace `CleverFerretTheme` (22 enums), `MediaThemes` and `CFLayout` with the three-ID theme JSON
   shown on the spec page.
3. Add `priText`, status and player tokens to `CFTokens`.
4. Build the library-management screens on the existing pipeline and tagging services.
