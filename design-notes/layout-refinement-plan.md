# Seven-layout refinement plan

Scope: the static design system, its interactive app prototype and its spec page. The Android
repository was inspected separately; [native parity](android-layout-parity.md) records the next
implementation work. This pass does not claim a shipped Android redesign.

## Implementation order and acceptance

1. **Establish the reference.** Base the work on merged PR #21. Inspect every layout on phone
   and wide screens, and compare shared native components against their stated design.
2. **Correct LCARS.** Derive both opposing elbows from common geometry, align the reference
   background with Android, move readouts into black space, use filled/text-led controls,
   and put feedback and playback into dedicated rows. Keep effects explicitly labeled.
3. **Refine each other layout.** Preserve its character while correcting navigation, sizing,
   wrapping, contrast and action emphasis.
4. **Prevent regressions.** Exercise all 20 screens in all seven families, check target sizes,
   exceptions, adaptive navigation and playback, and sample contrast across every palette/effect.
5. **Prepare native work.** Record source evidence, layout mapping, persistence migration,
   component dispatch and acceptance checks before changing Android production code.

| Layout | Implemented refinement | Acceptance evidence |
| --- | --- | --- |
| Compose | Live phone bar/tablet rail adaptation | Browser resize and playback checks |
| Ink Terminal | All radii 4px; small metadata increased to 12px | Shared token checks and phone review |
| Sweep Console | Concentric opposing sweeps, black field, filled controls, text transport, docks | Geometry, no dock/content overlap, readout and playback assertions |
| Metro Tiles | Preserve media title case; cap wide quick-action height | Browser title style and tile height checks |
| Aero Glass | Correct text against composited washes/panels; accessible UI gradients | All palette/effect contrast samples |
| Rule & Rail | Responsive hero title and reduced media tracking; readable rail labels | Phone review and target checks |
| Press | Quiet solid CTA, reduced weight, player shadow removed | Phone review and shared component rules |

Shared controls use minimum 48px targets, including small icon buttons, search, naming selectors,
plugin toggles and range controls. Browser tests use local React runtime files and fallback fonts
for deterministic structure checks; screenshots with the actual fonts were reviewed separately.

## Verification

- `npm run test:unit`: token/data/geometry checks, interpolated contrast and layout browser checks.
- `npm run validate`: the above plus landing-page accessibility and snapshot checks.
- `npx htmlhint docs/index.html docs/app.dc.html docs/theme-system.dc.html`: markup checks.
- Inline prototype/spec script syntax checked with Node's parser.

Recorded local result: 119,554 contrast checks and 2,082 system checks passed; 149 browser pages
passed, with all 140 screen/layout pairs covered. Phone and tablet screenshots were inspected
with the configured fonts. Landing-page baselines were refreshed with locked local font fixtures;
the visual runner waits for those fonts and compares decoded PNG pixels. A regression test checks
that PNG filter/compression differences cannot produce false visual changes. Its legacy
accessibility scanner reports seven non-blocking contrast warnings; it uses a simplified
transparent-background fallback and does not establish full WCAG conformance.

The glass audit models the configured wash and surface opacity endpoints; it is not a proof for
arbitrary images placed behind translucent content. The configured 180% saturation is included;
re-audit if those backdrops or blur saturation
change. Browser geometry checks use fallback fonts; real-font visual review remains necessary when
typography changes. Remaining intentional LCARS deviations are shown in the spec.
