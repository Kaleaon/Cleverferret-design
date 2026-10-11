/* CleverFerret design system · shared tokens and theme resolver.
 *
 * Single source of truth for every page in docs/ (app prototype, theme spec,
 * landing page) and for the Node checks in tests/. Loaded as a plain script in
 * the browser (window.CF) and via require() in Node.
 *
 * Mirrors the Kotlin sources in Kaleaon/CleverFerret:
 *   ui/modern/theme/CFTokens.kt          metal brushes, status + player tokens, E-Ink, High Contrast
 *   ui/modern/theme/CFTheme.kt           type scale (cfTypography)
 *   core/design-system/.../DesignTokensV1 spacing, radius, motion, contrast targets
 */
(function (root) {
  'use strict';

  // ─── Colour math ────────────────────────────────────────────────────────
  const hx = h => { h = String(h).replace('#', '').trim(); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h.slice(0, 6), 16); return isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
  const rgba = (h, a) => { const [r, g, b] = hx(h); return `rgba(${r},${g},${b},${a})`; };

  // WCAG 2.2 relative luminance / contrast, plus the palette correction engine.
  const contrast = {
    linearizeChannel(c) { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); },
    parseHex: hx,
    toHex,
    calculateLuminance(hex) { const [r, g, b] = hx(hex); return 0.2126 * this.linearizeChannel(r) + 0.7152 * this.linearizeChannel(g) + 0.0722 * this.linearizeChannel(b); },
    calculateContrastRatio(fg, bg) { const a = this.calculateLuminance(fg), b = this.calculateLuminance(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); },
    passesNormalText(fg, bg) { return this.calculateContrastRatio(fg, bg) >= 4.5; },
    passesLargeText(fg, bg) { return this.calculateContrastRatio(fg, bg) >= 3.0; },
    passesUIComponent(fg, bg) { return this.calculateContrastRatio(fg, bg) >= 3.0; },
    passesAAA(fg, bg) { return this.calculateContrastRatio(fg, bg) >= 7.0; },
    // First candidate that reaches minRatio; otherwise white/black, otherwise the nudged best.
    pickAccessibleInk(bg, candidates = [], minRatio = 4.5) {
      let best = candidates[0] || '#000000', bestRatio = this.calculateContrastRatio(best, bg);
      for (const cand of candidates) {
        const r = this.calculateContrastRatio(cand, bg);
        if (r >= minRatio) return cand;
        if (r > bestRatio) { best = cand; bestRatio = r; }
      }
      const wR = this.calculateContrastRatio('#FFFFFF', bg), bR = this.calculateContrastRatio('#000000', bg);
      if (wR >= minRatio) return '#FFFFFF';
      if (bR >= minRatio) return '#000000';
      return wR > bR ? '#FFFFFF' : '#000000';
    },
    // Walk fg toward white or black in small steps until it clears target against bg.
    adjustColorForContrast(fg, bg, target = 4.5) {
      return this.ensure(fg, [bg], target);
    },
    // Like adjustColorForContrast, but fg must clear target against every background in bgs.
    ensure(fg, bgs, target) {
      const worst = h => Math.min(...bgs.map(b => this.calculateContrastRatio(h, b)));
      if (worst(fg) >= target) return toHex(hx(fg));
      const avgLum = bgs.reduce((s, b) => s + this.calculateLuminance(b), 0) / bgs.length;
      const lighten = avgLum < 0.18;
      let rgb = hx(fg);
      for (let i = 0; i < 100; i++) {
        rgb = rgb.map(v => lighten ? Math.min(255, v + 3) : Math.max(0, v - 3));
        const h = toHex(rgb);
        if (worst(h) >= target) return h;
      }
      return lighten ? '#FFFFFF' : '#000000';
    },
    enforcePaletteContrast(c) {
      const r = { ...c };
      const reading = [r.bg, r.surf, r.surf2];
      r.ink = this.ensure(r.ink, reading, 4.5);
      r.ink2 = this.ensure(r.ink2, reading, 4.5);
      r.outv = this.ensure(r.outv, [r.bg, r.surf], 3.0);
      r.pri = this.ensure(r.pri, [r.bg, r.surf], 3.0);
      r.sec = this.ensure(r.sec, [r.bg], 3.0);
      r.err = this.ensure(r.err, [r.bg, r.surf], 3.0);
      if (!this.passesNormalText(r.onpri, r.pri)) r.onpri = this.pickAccessibleInk(r.pri, [r.onpri, r.bg, r.ink, '#FFFFFF', '#000000'], 4.5);
      if (!this.passesNormalText(r.onpriC, r.priC)) r.onpriC = this.pickAccessibleInk(r.priC, [r.onpriC, r.bg, r.ink, '#FFFFFF', '#000000'], 4.5);
      return r;
    },
  };
  const ratio = (a, b) => contrast.calculateContrastRatio(a, b);
  const pickInk = (bg, cands, min = 4.5) => contrast.pickAccessibleInk(bg, cands, min);

  // ─── Colour packs ──────────────────────────────────────────────────────
  // 13 MD3-style roles per pack, in KEYS order. Third field = light pack.
  const KEYS = 'bg surf surf2 ink ink2 pri onpri priC onpriC sec sec2 outv err'.split(' ');
  const ROLE_NAMES = { bg: 'background', surf: 'surface', surf2: 'surfaceVariant', ink: 'onSurface', ink2: 'onSurfaceVariant', pri: 'primary', onpri: 'onPrimary', priC: 'primaryContainer', onpriC: 'onPrimaryContainer', sec: 'secondary', sec2: 'tertiary', outv: 'outlineVariant', err: 'error' };
  const PALETTES = {
    ink: ['Ink Terminal', '0A1112 101A1C 1B2A2D D7F5E6 A7C8BC 6CFF9A 0A1112 1F6640 D7F5E6 3E4E5E 8AD0B0 365047 CF6679'],
    noir: ['Neo-Noir Neon', '090A10 111420 1C2130 E7EAF7 B9C0D8 AA43FF 090A10 4B1D73 E7EAF7 00D1FF FF3D9E 363D52 FF6B6B'],
    metro: ['Metro Cyan', '001A33 002448 3D4854 F0F8FF B8CAD6 00AEEF 001A33 0070CA F0F8FF 2D89EF 00AEEF 4D5A66 CF6679'],
    aurora: ['Aurora Glass Night', '0A1224 101C33 1D2B4A E7F0FF B5C7E9 6DE8FF 0A1224 2A6F85 E7F0FF 8C7CFF 7CFFD8 334364 CF6679'],
    slatec: ['Slate Cyan', '1A1F24 232930 3D4854 E8F0F5 B8CAD6 00D9FF 1A1F24 00A8CC 1A1F24 2A333D 6BA5B8 4D5A66 CF6679'],
    lcars: ['LCARS Amber', '120C1C 1C132A 3D1F5C F3E9FF D0B3E6 F2A65A 120C1C CC7A2B 120C1C A485F7 C5678D 4D2F5C CF6679'],
    amber: ['Midnight Amber', '0C1824 15202E 253447 E8EEF5 B8C5D6 FFBF00 0C1824 CC9900 0C1824 D4A76A D4A76A 3D4854 CF6679'],
    royalb: ['Royal Bronze', '1A0A30 220D40 3D1F5C F0E6FF D0B3E6 CD7F32 1A0A30 975929 F0E6FF 2D1550 9B7A5F 4D2F5C CF6679'],
    forest: ['Forest Copper', '0D1F0D 152915 2A4D2A E8F5E8 B8D9B8 B87333 0D1F0D 935E29 E8F5E8 1A3D1A 8FA886 3D5A3D CF6679'],
    crimson: ['Obsidian Crimson', '0A0A0A 141414 2D2D2D F5F5F5 D0D0D0 DC143C F5F5F5 B00F30 F5F5F5 A8505A A8505A 3D3D3D FF6B6B'],
    navy: ['Navy Gold', '0A1630 1A2645 2A3655 E8E3D8 C9C4B9 D4AF37 0A1630 715F33 E8E3D8 4A90E2 9C8970 44483E CF6679'],
    deco: ['Art Deco', '0B0A0A 141314 232124 F3E8D0 C9BDA2 D4AF37 0B0A0A 977B2F 0B0A0A F4E7CF B8A17A 4B4332 FFB4AB'],
    emerald: ['Emerald Silver', '0D3B2E 1A5544 2A6554 E8F5E8 C9E4D9 C0C0C0 0D3B2E 505050 E8F5E8 50C878 8BA888 3E4E44 CF6679'],
    royals: ['Royal Silver', '1A1535 211A40 3D2F5C F0EBFF C8BFE6 C0C0C0 1A1535 9A9A9A 1A1535 2A1F50 A89BC9 4D3F66 CF6679'],
    deep: ['Deep Purple Platinum', '1A0F2E 24153D 3D2A5C F0EBFF D0C0E6 E5E4E2 1A0F2E B8B7B5 1A0F2E 2E1A50 C8BFE0 4D3F6D CF6679'],
    charcoal: ['Charcoal Champagne', '1F1F1F 2A2A2A 3D3D3D F5F5F5 D0D0D0 F7E7CE 1F1F1F C5B8A5 1F1F1F 3D3D3D D4C4A8 4D4D4D CF6679'],
    slateg: ['Slate Gunmetal', '1A2029 232C38 3D4854 E6ECF2 B8C5D6 8F9CA8 1A2029 7D8A94 1A2029 2D3844 9DAAB6 4D5A66 CF6679'],
    rose: ['Rose Gold', '3D1F2B 4D2F3B 5D3F4B F5E5E8 E5D5D8 C1818B 3D1F2B 7D4A52 F5E5E8 D4A5A5 C9A9A9 4E3A3E FFB4AB'],
    burgundy: ['Burgundy Rose Gold', '2D0F1A 3D1525 5C2A3D FFE6ED E6C0CC B76E79 2D0F1A 93575F FFE6ED 4D1A2A C99BA5 6D3F4D FFB4AB'],
    aero: ['Frutiger Aero', 'EAF7FF F7FCFF DDF1FF 173A52 34566E 39B6F0 173A52 A9E6FF 173A52 79D87E 0A6FA0 A9C7DA BA1A1A', 1],
    paper: ['Paper & Ink', 'F0F0EB FAF9F6 EBEAE4 2C2C2C 454545 2C2C2C F0F0EB EBEAE4 2C2C2C 595959 6B6B6B C9C9C9 BA1A1A', 1],
    nouveau: ['Art Nouveau', 'F6F0E6 FFF8EE E7D8C7 2C2218 584638 7B5737 F6F0E6 D9C2A9 2C2218 769762 C57C52 CBB8A5 BA1A1A', 1],
    calm: ['Calm Clinical', 'F5FAFD FFFFFF E5EEF4 1F394B 445F72 38779E F5FAFD C4DFF2 1F394B 61B48B 7D9AB2 B5C8D5 BA1A1A', 1],
    solarpunk: ['Solarpunk Civic', 'F2FBF4 FBFFFC E2F2E8 1E3A27 456355 38B56A 1E3A27 BFEFD0 1E3A27 4FAEEA F2C46C B3D0BF BA1A1A', 1],
    // Accessibility packs, from CFTokens.kt (EInkTokens, HighContrastTokens).
    eink: ['E-Ink Monochrome', 'FFFFFF FFFFFF E0E0E0 000000 2B2B2B 000000 FFFFFF E0E0E0 000000 000000 4D4D4D 000000 000000', 1],
    contrast: ['High Contrast', '000000 000000 1C1C1C FFFFFF FFFFFF FFFF00 000000 FFFF00 000000 00FFFF FFFFFF FFFF00 FF6B6B'],
  };
  const FAMILIES = [
    ['Terminal & Neon', ['ink', 'noir', 'metro', 'aurora', 'slatec']],
    ['Console & Amber', ['lcars', 'amber', 'royalb', 'forest', 'crimson']],
    ['Metal & Jewel', ['navy', 'deco', 'emerald', 'royals', 'deep', 'charcoal', 'slateg', 'rose', 'burgundy']],
    ['Daylight', ['aero', 'paper', 'nouveau', 'calm', 'solarpunk']],
    ['Accessibility', ['eink', 'contrast']],
  ];
  // Metal brush stops [shadow, base, highlight, shimmer]. CFTokens.kt verbatim where the pack exists there.
  const METAL = {
    navy: ['#7A5B1E', '#D4AF37', '#FFE680', '#FFFCE0'], rose: ['#8C4F4A', '#E6B0A2', '#F5D4C8', '#FFEDE5'],
    emerald: ['#6E7478', '#B8BEC2', '#E5E9EC', '#FFFFFF'], amber: ['#8C5A1F', '#FFA94D', '#FFCB80', '#FFE6BF'],
    paper: ['#454545', '#9A9A9A', '#D6D6D6', '#FFFFFF'], noir: ['#6B0E66', '#FF2EAA', '#FF80D4', '#00F0FF'],
    lcars: ['#A85C2E', '#F2A65A', '#FFCB80', '#FFE6BF'], metro: ['#4A4A48', '#878681', '#BDBBB8', '#D0CFCC'],
    eink: ['#000000', '#000000', '#000000', '#000000'], contrast: ['#FFFF00', '#FFFF00', '#FFFF00', '#FFFF00'],
  };
  // Packs that pin other axes. E-Ink panels ghost on gradients and animation;
  // High Contrast drops glass, glow and gradient borders that dilute edges.
  const CLAMPS = {
    eink: { effect: 'flat', motion: 'off', why: 'E-Ink panels ghost on gradients and animation, so this pack locks effects to Flat and motion to Off.' },
    contrast: { effect: 'flat', why: 'Glass, glow and gradient borders soften edges, so this pack locks effects to Flat.' },
  };

  // Domain status colours (CFStatusColors). Never colour alone: always paired with an icon and a label.
  const STATUS = [
    ['completed', 'Completed', 'check_circle'], ['ongoing', 'Ongoing', 'autorenew'], ['hiatus', 'Hiatus', 'pause_circle'],
    ['cancelled', 'Cancelled', 'cancel'], ['downloading', 'Downloading', 'downloading'], ['outdated', 'Update available', 'update'],
    ['failed', 'Failed', 'error'], ['neutral', 'Not downloaded', 'radio_button_unchecked'],
  ];
  const STATUS_BASE = {
    dark: { completed: '#66BB6A', ongoing: '#4FC3F7', hiatus: '#FFB74D', cancelled: '#E57373', downloading: '#26C6DA', outdated: '#FFCA28', failed: '#EF5350' },
    light: { completed: '#2E7D32', ongoing: '#1565C0', hiatus: '#B45309', cancelled: '#C62828', downloading: '#00838F', outdated: '#A15C00', failed: '#B3261E' },
    contrast: { completed: '#00FF00', ongoing: '#00FFFF', hiatus: '#FFFF00', cancelled: '#FF6B6B', downloading: '#00FFFF', outdated: '#FFFF00', failed: '#FF6B6B' },
  };

  // ─── Layout packs ──────────────────────────────────────────────────────
  // Radii: rl large panel · rp panel · rt tile · rc cover · rs control · ri icon well · ra artwork (999 = pill).
  const LAYOUTS = {
    compose: { name: 'Compose', nav: 'tabs', navSpec: 'bar → rail', fontName: 'Roboto', ff: 'Roboto,system-ui,sans-serif', dff: 'Roboto,system-ui,sans-serif', lf: 'Roboto,system-ui,sans-serif', rl: 18, rp: 14, rt: 12, rc: 6, rs: 999, ri: 10, ra: 20, tt: 'none', htls: '-.01em', tw: 700, card: 'compose', qgap: '8px',
      desc: 'MD3 · rounded 18/14/12 · pill CTAs · navigation bar',
      note: 'Today\'s modern surface: MD3 roles, 18/14/12 rounding, pill metal CTAs, NavigationBar on phones and NavigationRail on tablets.' },
    terminal: { name: 'Ink Terminal', nav: 'tabs', navSpec: 'tabs → rail', fontName: 'JetBrains Mono', ff: '"JetBrains Mono",monospace', dff: '"JetBrains Mono",monospace', lf: '"JetBrains Mono",monospace', rl: 8, rp: 4, rt: 4, rc: 2, rs: 4, ri: 4, ra: 4, tt: 'uppercase', htls: '.18em', tw: 700, card: 'box', qgap: '9px',
      desc: 'Mono · 4px corners · boxed cards · tracked caps',
      note: 'Dense grid, mono type, 4px corners, boxed cards with hairline outlines, tracked uppercase titles. The reader switches to mono too.' },
    sweep: { name: 'Sweep Console', nav: 'sweep', navSpec: 'sweep → sweep', fontName: 'Antonio + Nunito Sans', ff: '"Nunito Sans",sans-serif', dff: 'Antonio,sans-serif', lf: 'Antonio,sans-serif', rl: 0, rp: 0, rt: 0, rc: 0, rs: 999, ri: 999, ra: 0, tt: 'uppercase', htls: '.1em', tw: 700, card: 'lcars', qgap: '3px',
      desc: 'LCARS elbow frame · rail segments are the nav',
      note: 'The elbow (bar → curve → rail) is the frame and the rail segments are the navigation. The content corner is concentric with the elbow arc at a uniform gap, titles sit bottom-right in the bar, headers run cap → title → bar → end cap, and every bar ends in a rounded cap. Fills only: no borders, no gradients.' },
    tiles: { name: 'Metro Tiles', nav: 'tiles', navSpec: 'pivot + app bar → rail', fontName: 'Open Sans', ff: '"Open Sans",sans-serif', dff: '"Open Sans",sans-serif', lf: '"Open Sans",sans-serif', rl: 0, rp: 0, rt: 0, rc: 0, rs: 0, ri: 0, ra: 0, tt: 'lowercase', htls: '0', tw: 300, card: 'flat', qgap: '4px',
      desc: 'Windows Phone: pivot headers, square accent tiles, circle app bar',
      note: 'Zero radius, light lowercase pivot titles that scroll as one strip, solid accent tiles, and a round-button app bar along the bottom edge.' },
    glass: { name: 'Aero Glass', nav: 'tabs', navSpec: 'tabs → rail', fontName: 'Nunito Sans', ff: '"Nunito Sans",sans-serif', dff: '"Nunito Sans",sans-serif', lf: '"Nunito Sans",sans-serif', rl: 18, rp: 16, rt: 12, rc: 8, rs: 12, ri: 12, ra: 22, tt: 'none', htls: '0', tw: 800, card: 'soft', qgap: '11px',
      desc: 'Soft glossy panels · 12–18px · comfortable spacing',
      note: 'Glossy soft panels with an inset top highlight, 12–18px rounding and comfortable spacing. Pairs best with the Glass effect pack.' },
    rules: { name: 'Rule & Rail', nav: 'rail', navSpec: 'rail → rail', fontName: 'Jost', ff: 'Jost,sans-serif', dff: 'Jost,sans-serif', lf: 'Jost,sans-serif', rl: 0, rp: 0, rt: 0, rc: 0, rs: 0, ri: 0, ra: 0, tt: 'uppercase', htls: '.3em', tw: 500, card: 'rule', qgap: '0px',
      desc: 'Deco hairlines · sharp · side rail navigation',
      note: 'Deco discipline: hairline rules instead of fills, sharp corners, 0.3em tracking and a side rail on every form factor.' },
    press: { name: 'Press', nav: 'tabs', navSpec: 'tabs → rail', fontName: 'Source Serif 4 + Jost', ff: '"Source Serif 4",Georgia,serif', dff: '"Source Serif 4",Georgia,serif', lf: 'Jost,sans-serif', rl: 6, rp: 3, rt: 2, rc: 2, rs: 2, ri: 2, ra: 4, tt: 'none', htls: '0', tw: 700, card: 'quiet', qgap: '0px',
      desc: 'Editorial serif · 2px corners · quiet rows',
      note: 'Editorial: serif body, 2px corners, quiet underlined rows and generous leading. The legibility layout for large type.' },
  };

  // ─── Effect packs ──────────────────────────────────────────────────────
  // slots: CTA·wordmark, surfaces, background, active/focus, borders, animated.
  const EFFECTS = {
    flat: { name: 'Flat', cta: 0, desc: 'Solid primary everywhere, no effects', slots: ['Solid primary', 'Solid', 'None', 'Primary tint', 'Solid outline', 'None'] },
    sheen: { name: 'Sheen', cta: 1, desc: 'Metal brush on CTAs, wordmark and chips', slots: ['Metal brush', 'Solid', 'None', 'Primary tint', 'Solid outline', 'None'] },
    shimmer: { name: 'Shimmer', cta: 1, shimmer: 1, desc: 'Metal plus an animated sweep', slots: ['Metal + sweep', 'Solid', 'None', 'Primary tint', 'Solid outline', 'Shimmer 2.8s'] },
    neon: { name: 'Neon', cta: 0, glow: 1, desc: 'Glow halos on CTAs, tiles and the active nav item', slots: ['Solid + glow', 'Glow halo', 'None', 'Outer glow', 'Solid outline', 'None'] },
    glass: { name: 'Glass', cta: 1, glass: 1, bg: 'aurora', desc: 'Blurred panels over an aurora wash', slots: ['Metal brush', 'Blur 14 · sat 180%', 'Aurora wash', 'Primary tint', 'Solid outline', 'None'] },
    architect: { name: 'Architect', cta: 1, shimmer: 1, glow: 1, pulse: 1, bg: 'pattern', desc: 'Geometric lattice, crystal pulse and shimmer', slots: ['Metal + sweep', 'Solid + glow', 'Geometric lattice', 'Crystal pulse', 'Solid outline', 'Shimmer + pulse'] },
    grain: { name: 'Grain', cta: 1, bg: 'noise', desc: 'Metal brush over subtle film grain', slots: ['Metal brush', 'Solid', 'Noise grain', 'Primary tint', 'Solid outline', 'None'] },
    prism: { name: 'Prism', cta: 1, gborder: 1, pulse: 1, desc: 'Metal gradient borders and crystal pulse', slots: ['Metal brush', 'Solid', 'None', 'Crystal pulse', 'Metal gradient', 'Pulse 2.4s'] },
  };

  // ─── Foundations ───────────────────────────────────────────────────────
  // cfTypography (CFTheme.kt). [role, label, size, line, weight, tracking(px), family slot]
  const TYPE = [
    ['displayLarge', 'Display L', 44, 52, 700, -1.0, 'dff'], ['displayMedium', 'Display M', 32, 40, 700, -0.6, 'dff'],
    ['headlineLarge', 'Headline L', 26, 32, 700, -0.4, 'dff'], ['headlineMedium', 'Headline M', 22, 28, 700, -0.3, 'dff'],
    ['titleLarge', 'Title L', 17, 24, 700, 0, 'dff'], ['titleMedium', 'Title M', 15, 20, 600, 0, 'ff'], ['titleSmall', 'Title S', 13, 18, 600, 0, 'ff'],
    ['bodyLarge', 'Body L', 16, 24, 400, 0, 'ff'], ['bodyMedium', 'Body M', 14, 20, 400, 0, 'ff'], ['bodySmall', 'Body S', 12, 16, 400, 0, 'ff'],
    ['labelLarge', 'Label L', 13, 18, 600, 0.2, 'lf'], ['labelMedium', 'Label M', 11, 16, 600, 1.4, 'lf'], ['labelSmall', 'Label S', 10, 14, 700, 1.6, 'lf'],
  ];
  // DesignTokensV1.SPACING_DP, with the CFSpacing alias where one exists.
  const SPACE = [['space.0', 0], ['space.1', 4, 'xs'], ['space.2', 8, 'sm'], ['space.3', 12, 'md'], ['space.4', 16, 'lg'], ['space.5', 20], ['space.6', 24, 'xl'], ['space.8', 32, 'xxl'], ['space.10', 40], ['space.12', 48, 'touch target'], ['space.16', 64]];
  const GUTTERS = [['lcarsGutter', 6], ['metroGutter', 10]];
  const RADIUS = [['radius.s', 4], ['radius.m', 8], ['radius.l', 12], ['radius.xl', 16], ['radius.full', 999]];
  const MOTION = {
    durations: [['fast', 100, 'Press feedback, toggles'], ['normal', 200, 'Screen enter, sheet, chip'], ['slow', 320, 'Large surfaces, onboarding steps']],
    easing: [['standard', 'cubic-bezier(.2,0,0,1)'], ['decelerate', 'cubic-bezier(.05,.7,.1,1)']],
    loops: [['shimmer', 2800, 'Metal sweep (Shimmer, Architect)'], ['pulse', 2400, 'Crystal pulse (Architect, Prism)']],
  };
  const CONTRAST = { body: 4.5, large: 3.0, interactive: 3.0, focus: 3.0, aaa: 7.0 };

  // ─── Prototype content ─────────────────────────────────────────────────
  const CATALOG = [
    { id: 'fr', title: 'Frankenstein', author: 'Mary Shelley', kind: 'Book', hue: '#4A2A1B', p: .04, subtitle: 'Letter 1 · 3h 40m left', pd: 1, size: '0.4 MB', status: 'completed', tags: ['Gothic', 'Classic', 'Public domain'], year: 1818,
      about: 'Victor Frankenstein\'s ambition outruns his conscience. Told through the letters of an Arctic explorer, Shelley\'s 1818 novel is the founding text of science fiction.' },
    { id: 'tb', title: 'The Three-Body Problem', author: 'Liu Cixin', kind: 'Book', hue: '#1B3A5C', p: .42, subtitle: 'Ch. 7 · 4h 12m left', size: '1.2 MB', tags: ['Hard SF', 'First contact', 'Translated'], year: 2008,
      about: 'A signal sent during the Cultural Revolution is answered, and nothing about physics stays settled.' },
    { id: 'phm', title: 'Project Hail Mary', author: 'Andy Weir', kind: 'Audiobook', hue: '#5C2E1B', p: .71, subtitle: '12h 04m · 1.2×', dur: 58080, size: '486 MB', tags: ['Space', 'Survival', 'Narrated'], year: 2021,
      about: 'A lone astronaut wakes with no memory on a ship bound for Tau Ceti, and has to science his way out of an extinction event.' },
    { id: 'hf', title: 'Hard Fork · Ep. 184', author: 'NYT', kind: 'Podcast', hue: '#2E1B5C', p: .18, subtitle: '23:14 / 1:18:02', dur: 4682, size: '72 MB', tags: ['Tech', 'Weekly'], year: 2026,
      about: 'The week in technology news, with interviews and listener questions.' },
    { id: 'sg', title: 'Saga · Vol. 11', author: 'Vaughan / Staples', kind: 'Comic', hue: '#1B5C3E', p: .55, subtitle: 'p. 87 / 156', size: '212 MB', status: 'ongoing', tags: ['Space opera', 'Collected edition'], year: 2024,
      about: 'The family saga picks up years later, with Hazel narrating from somewhere the reader can\'t see yet.' },
    { id: 'tm', title: 'The Martian', author: 'Andy Weir', kind: 'Audiobook', hue: '#6B2E12', p: 0, subtitle: '10h 53m', dur: 39180, size: '—', tags: ['Survival', 'Mars'], year: 2014,
      about: 'Stranded on Mars, botanist Mark Watney has a hab, a rover and a lot of potatoes.' },
    { id: 'rl', title: 'Radiolab', author: 'WNYC Studios', kind: 'Podcast', hue: '#1B4A5C', p: 0, subtitle: '58:10', dur: 3490, size: '—', tags: ['Science', 'Storytelling'], year: 2026,
      about: 'Investigations into strange questions, told with sound design to match.' },
    { id: 'oc', title: 'Out of Cruel Space', author: 'r/HFY', kind: 'Web Fiction', hue: '#2E3A5C', p: .3, subtitle: 'Ch. 41 · 8 new', size: '—', status: 'ongoing', tags: ['Serial', 'HFY', 'Reddit'], year: 2026,
      about: 'A Reddit serial, imported as an EPUB and refreshed when new chapters land. Author comments and thread continuations are captured with each chapter.' },
    { id: 'kb', title: 'Kind of Blue', author: 'Miles Davis', kind: 'Music', hue: '#1B2E5C', p: 0, subtitle: '45:44', dur: 2744, size: '—', tags: ['Jazz', 'Modal', '1959'], year: 1959,
      about: 'Five tracks recorded in two sessions that became the best-selling jazz record of all time.' },
    { id: 'dr', title: 'Dracula', author: 'Bram Stoker', kind: 'Book', hue: '#5C1B2A', p: 0, subtitle: '27 chapters', pd: 1, size: '—', tags: ['Gothic', 'Epistolary', 'Public domain'], year: 1897,
      about: 'Journals, letters and newspaper clippings track a Transylvanian count\'s move to London.' },
    { id: 'ar', title: 'Arrival', author: 'Denis Villeneuve', kind: 'Movie', hue: '#2B4150', p: .36, subtitle: '1h 56m · 74m left', dur: 6960, size: '2.1 GB', tags: ['Sci-fi', 'Drama', 'Plex'], year: 2016,
      about: 'A linguist is asked to talk to visitors whose language changes how she experiences time.' },
  ];
  const SCREENS = [
    { id: 'home', name: 'Home', group: 'Browse', tab: 1, src: 'ui/modern/home/ModernHomeScreen.kt · components/Scaffolding.kt · SharedComponents.kt (MiniPlayer)' },
    { id: 'library', name: 'Library', group: 'Browse', tab: 1, src: 'ui/modern/library/ModernLibraryScreen.kt · domain/Models.kt' },
    { id: 'discover', name: 'Discover', group: 'Browse', tab: 1, src: 'ui/modern/discover/ModernDiscoverScreen.kt' },
    { id: 'downloads', name: 'Downloads', group: 'Browse', tab: 1, src: 'new · status tokens from CFTokens.kt (CFStatusColors)' },
    { id: 'settings', name: 'Settings', group: 'Browse', tab: 1, src: 'ui/modern/settings/ModernSettingsScreen.kt' },
    { id: 'search', name: 'Search', group: 'Browse', src: 'ui/modern/search/ModernSearchScreen.kt' },
    { id: 'detail', name: 'Item detail', group: 'Browse', src: 'ui/modern/detail/ModernDetailScreen.kt' },
    { id: 'inbox', name: 'Import inbox', group: 'Library management', src: 'ui/modern/imports/ModernImportScreen.kt · services/pipeline/* (cataloging pipeline) · organization/DuplicateDetectionService.kt' },
    { id: 'match', name: 'Fix match', group: 'Library management', src: 'ui/modern/metadata/ModernMetadataEditorScreen.kt · services/metadata/sources/* · TVMazeService.kt' },
    { id: 'repair', name: 'File repair', group: 'Library management', src: 'services/epub/EpubValidationService.kt · EpubSplitService.kt · EpubMergeService.kt (new UI)' },
    { id: 'organize', name: 'Sort rules', group: 'Library management', src: 'ui/modern/storage/ModernStorageBrowserScreen.kt · services/StorageImportPlanBuilder.kt (new naming templates)' },
    { id: 'plugins', name: 'Calibre plugins', group: 'Library management', src: 'Kaleaon/calibre_plugins (cores run under Chaquopy with a calibre shim) · design-notes/calibre-plugins.md' },
    { id: 'tags', name: 'Tag explorer', group: 'Library management', src: 'ui/modern/tags/ModernTagExplorerScreen.kt · services/tagging/UniversalTagManager.kt · TagType' },
    { id: 'player', name: 'Audio player', group: 'Play & read', src: 'ui/modern/player/ModernAudioPlayerScreen.kt' },
    { id: 'queue', name: 'Queue', group: 'Play & read', src: 'ui/modern/player/ModernQueueScreen.kt' },
    { id: 'reader', name: 'Reader', group: 'Play & read', src: 'ui/modern/reader/ModernReaderScreen.kt · docs/THEMING.md (Day / Sepia / Night)' },
    { id: 'video', name: 'Video player', group: 'Play & read', src: 'ui/modern/player/ModernVideoPlayerScreen.kt' },
    { id: 'stats', name: 'Reading stats', group: 'Play & read', src: 'ui/modern/stats/ModernReadingStatsScreen.kt' },
    { id: 'themes', name: 'Theme Studio', group: 'Personalise', src: 'ui/modern/theme/ModernThemePickerScreen.kt (extended to layout / colour / effect tabs)' },
    { id: 'onboarding', name: 'Onboarding', group: 'Personalise', src: 'ui/modern/onboarding/ModernOnboardingScreen.kt' },
  ];
  const DEFAULT_THEME = { layout: 'compose', palette: 'navy', effect: 'sheen', motion: 'system' };

  // ─── Library management: Calibre-style cataloguing + Plex-style sorting ──
  // Cataloging pipeline (services/pipeline/PipelineStage.kt), plus the repair and file steps.
  const PIPELINE = [
    ['scan', 'Scan', 'RAW_EXTRACTION', 'Read files and embedded tags'],
    ['normalize', 'Normalize', 'SCHEMA_NORMALIZATION', 'Clean names, detect kind, split multi-part sets'],
    ['match', 'Match', 'REMOTE_ENRICHMENT', 'Identify against metadata sources'],
    ['repair', 'Repair', 'new', 'Fix badly formatted files'],
    ['file', 'File', 'STAGING_PERSISTENCE', 'Rename and sort to the library destination'],
  ];
  // Match confidence → status token. Strong matches file automatically; the rest wait for review.
  const CONFIDENCE = [[90, 'completed', 'Strong match', 'verified'], [60, 'hiatus', 'Needs review', 'help'], [1, 'failed', 'Weak match', 'warning'], [0, 'failed', 'No match', 'search_off']];
  const confidenceOf = n => CONFIDENCE.find(c => n >= c[0]);
  // Issue severity → status token.
  const SEVERITY = { error: ['failed', 'error', 'Blocks reading or playback'], warning: ['hiatus', 'warning', 'Degrades the experience'], info: ['ongoing', 'info', 'Optional improvement'] };
  // Repairs the format doctor can run. [severity, problem, fix, before, after]
  const FIXES = {
    convert: ['error', 'Old Kindle format (MOBI)', 'Convert to EPUB 3 so reflow, TTS and annotations work', 'MOBI 6', 'EPUB 3.3'],
    toc: ['error', 'Table of contents missing 18 chapters', 'Rebuild the TOC from chapter headings', '3 entries', '21 entries'],
    encoding: ['warning', 'Mixed text encodings', 'Normalise 4 Windows-1252 files to UTF-8', '“We are hereâ€\u009d', '“We are here.”'],
    cover: ['info', 'No embedded cover', 'Embed the matched cover at 1400 × 2100', 'None', 'Embedded'],
    hyphen: ['warning', 'Scanner hyphenation', 'Rejoin 212 words split at old line ends', 'sig- nal', 'signal'],
    fonts: ['warning', 'Hard-coded font sizes', 'Strip inline styles that override reader settings', '9pt fixed', 'Reader size'],
    container: ['info', 'Legacy AVI container', 'Remux to MKV without re-encoding', 'AVI', 'MKV'],
    tags: ['warning', 'Missing track tags', 'Write titles, numbers and album artist from MusicBrainz', 'Track01', '01 - So What'],
    pages: ['warning', 'Spreads out of order', 'Reorder 6 double-page spreads and mark them as two-up', 'p. 41, 40', 'p. 40–41'],
    merge: ['info', 'Chapter of an existing serial', 'Append to Out of Cruel Space.epub as chapter 42', 'Loose HTML', 'Chapter 42'],
    ocr: ['error', 'Image-only PDF', 'Run OCR (English) to add a searchable text layer', 'No text', 'Searchable'],
    parts: ['warning', '12 separate MP3 parts', 'Merge into one chaptered M4B audiobook', '12 files', '1 file'],
    chapters: ['info', 'No chapter markers', 'Detect chapters from silences and the publisher TOC', '0 chapters', '38 chapters'],
    loudness: ['info', 'Uneven loudness', 'Normalise to −18 LUFS for steady volume', '−11 to −24 LUFS', '−18 LUFS'],
  };
  // Metadata agents per kind (Calibre metadata sources + Plex agents).
  const AGENTS = {
    Book: ['Open Library', 'Google Books', 'Goodreads', 'ISFDB'], Audiobook: ['Audible', 'Open Library', 'Audnexus'], Comic: ['ComicVine', 'Metron'],
    Movie: ['TMDB', 'OMDb'], TV: ['TVMaze', 'TheTVDB'], Music: ['MusicBrainz', 'Discogs'], 'Web Fiction': ['Reddit', 'Royal Road'], Document: ['ISBN lookup', 'Open Library'],
  };
  // Import inbox sample: badly named, badly formatted files on their way into the library.
  const INBOX = [
    { id: 'dune', file: 'Dune Messiah - Frank Herbert.epub', size: '0.9 MB', kind: 'Book', hue: '#7A4A1F', conf: 71, agent: 'Open Library', title: 'Dune Messiah', author: 'Frank Herbert', fixes: ['hyphen', 'fonts'], lib: 'books', vals: { author_sort: 'Herbert, Frank', authors: 'Frank Herbert', series: 'Dune', series_index: '02', title: 'Dune Messiah', id: '1187', ext: 'epub' } },
    { id: 'tbp', file: '3body_FINAL(1).mobi', size: '2.4 MB', kind: 'Book', hue: '#1B3A5C', conf: 96, agent: 'Open Library', title: 'The Three-Body Problem', author: 'Liu Cixin', fixes: ['convert', 'toc', 'encoding', 'cover'], lib: 'books', vals: { author_sort: 'Liu, Cixin', authors: 'Liu Cixin', series: 'Remembrance of Earth’s Past', series_index: '01', title: 'The Three-Body Problem', id: '1188', ext: 'epub' } },
    { id: 'rec', file: 'recursion_disc01.mp3 + 11 more', size: '486 MB', kind: 'Audiobook', hue: '#3B2A5C', conf: 93, agent: 'Audible', title: 'Recursion', author: 'Blake Crouch', fixes: ['parts', 'chapters', 'loudness'], lib: 'audiobooks', vals: { author_sort: 'Crouch, Blake', title: 'Recursion', ext: 'm4b' } },
    { id: 'arr', file: 'arrival.2016.1080p.mkv', size: '2.1 GB', kind: 'Movie', hue: '#2B4150', conf: 99, agent: 'TMDB', title: 'Arrival', author: '2016 · Denis Villeneuve', fixes: [], lib: 'movies', vals: { title: 'Arrival', year: '2016', ext: 'mkv' } },
    { id: 'tz', file: 'twilight.zone.s01e08.avi', size: '412 MB', kind: 'TV', hue: '#2A2A33', conf: 97, agent: 'TVMaze', title: 'Time Enough at Last', author: 'The Twilight Zone (1959) · S01E08', fixes: ['container'], lib: 'tv', vals: { show: 'The Twilight Zone', show_year: '1959', season: '01', episode: '08', episode_title: 'Time Enough at Last', ext: 'mkv' } },
    { id: 'kob', file: 'Track01.flac + 4 more', size: '312 MB', kind: 'Music', hue: '#1B2E5C', conf: 100, agent: 'MusicBrainz', title: 'Kind of Blue', author: 'Miles Davis · 1959', fixes: ['tags', 'cover'], lib: 'music', vals: { album_artist: 'Miles Davis', album: 'Kind of Blue', year: '1959', track: '01', title: 'So What', ext: 'flac' } },
    { id: 'saga', file: 'saga_v11.cbz', size: '212 MB', kind: 'Comic', hue: '#1B5C3E', conf: 88, agent: 'ComicVine', title: 'Saga · Vol. 11', author: 'Vaughan / Staples', fixes: ['pages'], lib: 'comics', vals: { series: 'Saga', series_year: '2012', volume: '11', year: '2024', ext: 'cbz' } },
    { id: 'hfy', file: 'out-of-cruel-space-ch42.html', size: '48 KB', kind: 'Web Fiction', hue: '#2E3A5C', conf: 100, agent: 'Reddit', title: 'Out of Cruel Space · Ch. 42', author: 'r/HFY', fixes: ['merge'], lib: 'webfiction', vals: { source: 'r-HFY', series: 'Out of Cruel Space', ext: 'epub' } },
    { id: 'scan', file: 'IMG_2231.pdf', size: '41 MB', kind: 'Document', hue: '#4A4A48', conf: 0, agent: 'ISBN lookup', title: 'Unidentified PDF', author: '212 scanned pages', fixes: ['ocr'], lib: 'books', vals: { author_sort: 'Unknown', authors: 'Unknown', series: '', series_index: '', title: 'IMG_2231', id: '1189', ext: 'pdf' } },
    { id: 'dup', file: 'frankenstein (1).epub', size: '0.4 MB', kind: 'Book', hue: '#4A2A1B', conf: 100, agent: 'Open Library', title: 'Frankenstein', author: 'Mary Shelley', fixes: [], dup: 'Same SHA-1 as the copy filed on 12 Sep', lib: 'books', vals: { author_sort: 'Shelley, Mary', authors: 'Mary Shelley', series: '', series_index: '', title: 'Frankenstein', id: '0042', ext: 'epub' } },
  ];
  // Candidate matches for the Fix match screen. Fields not listed fall back to the inbox item.
  const CANDIDATES = {
    dune: [
      { title: 'Dune Messiah', author: 'Frank Herbert', year: '1969', edition: 'Ace · mass market', agent: 'Open Library', conf: 71, hue: '#7A4A1F' },
      { title: 'Dune Messiah (Deluxe)', author: 'Frank Herbert', year: '2019', edition: 'Ace · hardcover', agent: 'Google Books', conf: 68, hue: '#8C5A2F' },
      { title: 'Children of Dune', author: 'Frank Herbert', year: '1976', edition: 'Berkley', agent: 'Open Library', conf: 34, hue: '#5C3A1F' },
    ],
  };
  // Field diff for a match: [field, current embedded value, matched value].
  const MATCH_FIELDS = {
    dune: [['Title', 'Dune Messiah - Frank Herbert', 'Dune Messiah'], ['Author', 'Unknown', 'Frank Herbert'], ['Sort as', '', 'Herbert, Frank'], ['Series', '', 'Dune #2'], ['Published', '', '1969 · Ace'], ['ISBN', '', '978-0-593-09823-3'], ['Language', 'und', 'English'], ['Tags', 'Fiction', 'Science fiction › Space opera, Politics, Desert worlds'], ['Cover', 'None', '1400 × 2100'], ['Summary', '', 'Twelve years after Arrakis, Paul is emperor, and the jihad he foresaw is burning across the stars.']],
  };
  // Destination naming conventions. Calibre's library layout for books, Plex/Jellyfin layout for video and music.
  const NAMING = {
    books: { name: 'Books', icon: 'menu_book', root: '/Media', options: [
      ['calibre', 'Calibre', '{author_sort}/{title} ({id})/{title} - {authors}.{ext}'],
      ['series', 'By series', 'Books/{author_sort}/{series}/{series_index} - {title}.{ext}'],
      ['flat', 'Flat', 'Books/{title} - {authors}.{ext}']] },
    audiobooks: { name: 'Audiobooks', icon: 'headphones', root: '/Media', options: [
      ['plex', 'Plex', 'Audiobooks/{author_sort}/{title}/{title}.{ext}'],
      ['flat', 'Flat', 'Audiobooks/{title}.{ext}']] },
    comics: { name: 'Comics', icon: 'auto_stories', root: '/Media', options: [
      ['komga', 'Komga', 'Comics/{series} ({series_year})/{series} v{volume} ({year}).{ext}'],
      ['flat', 'Flat', 'Comics/{series} v{volume}.{ext}']] },
    movies: { name: 'Movies', icon: 'movie', root: '/Media', options: [
      ['plex', 'Plex', 'Movies/{title} ({year})/{title} ({year}).{ext}'],
      ['flat', 'Flat', 'Movies/{title} ({year}).{ext}']] },
    tv: { name: 'TV', icon: 'tv', root: '/Media', options: [
      ['plex', 'Plex', 'TV/{show} ({show_year})/Season {season}/{show} ({show_year}) - s{season}e{episode} - {episode_title}.{ext}'],
      ['flat', 'Flat', 'TV/{show} - s{season}e{episode}.{ext}']] },
    music: { name: 'Music', icon: 'album', root: '/Media', options: [
      ['plex', 'Plex', 'Music/{album_artist}/{album} ({year})/{track} - {title}.{ext}'],
      ['flat', 'Flat', 'Music/{album_artist} - {album}/{track} {title}.{ext}']] },
    webfiction: { name: 'Web fiction', icon: 'forum', root: '/Media', options: [
      ['serial', 'By source', 'Web Fiction/{source}/{series}.{ext}'],
      ['flat', 'Flat', 'Web Fiction/{series}.{ext}']] },
  };
  const templateParts = tpl => tpl.split(/(\{[a-z_]+\})/).filter(Boolean).map(t => ({ text: t, token: /^\{[a-z_]+\}$/.test(t) }));
  const applyTemplate = (tpl, vals) => tpl.replace(/\{([a-z_]+)\}/g, (_, k) => vals[k] != null ? vals[k] : '').replace(/\/{2,}/g, '/').replace(/\/ - /g, '/').replace(/ \(\)/g, '');
  // Tag provenance (data/local/entity/UnifiedTag.kt TagType) and tag-browser categories.
  const TAG_SOURCES = { user: ['person', 'You'], auto: ['auto_awesome', 'Auto'], calibre: ['menu_book', 'Calibre'], plex: ['cast', 'Plex'], jellyfin: ['dns', 'Jellyfin'] };
  const TAG_GROUPS = [
    ['Genre', 'category', [['Fiction › Science fiction', 412, 'calibre'], ['Fiction › Science fiction › Hard SF', 38, 'calibre'], ['Fiction › Science fiction › Space opera', 51, 'auto'], ['Fiction › Gothic', 17, 'calibre'], ['Nonfiction › Science', 64, 'auto'], ['Jazz › Modal', 22, 'plex']]],
    ['Tropes & themes', 'theater_comedy', [['First contact', 29, 'user'], ['Found family', 18, 'user'], ['Survival', 24, 'auto'], ['Time', 11, 'user'], ['Unreliable narrator', 7, 'user']]],
    ['Mood', 'mood', [['Hopeful', 46, 'user'], ['Tense', 31, 'user'], ['Funny', 19, 'user'], ['Melancholy', 12, 'user']]],
    ['Setting', 'public', [['Space', 88, 'auto'], ['Mars', 6, 'auto'], ['Arctic', 3, 'auto'], ['Near future', 21, 'auto']]],
    ['Content notes', 'shield', [['Violence', 34, 'user'], ['Body horror', 5, 'user']]],
    ['Collections', 'collections_bookmark', [['Weekend reads', 14, 'user'], ['Award winners', 27, 'plex'], ['Family movie night', 19, 'jellyfin']]],
    ['Reading status', 'bookmark', [['Want to read', 63, 'user'], ['Reading', 4, 'user'], ['Finished', 287, 'auto'], ['Did not finish', 9, 'user']]],
  ];
  // Calibre plugins from Kaleaon/calibre_plugins, described as mobile manifests. Each plugin's core
  // (core.py / engine.py / storykit.py …) has no calibre or Qt imports, so it can run on-device under
  // Chaquopy with a small `calibre` shim; the Qt dialogs are replaced by these field lists.
  // field: [type, label, detail, default]  type = switch | text | secret | seg | chips
  const PLUGINS = [
    { id: 'takeout', name: 'Takeout Book Fixer', version: '1.1.1', icon: 'unarchive', caps: ['Import', 'Repair'], handoff: 'inbox', core: 'plugin/core.py', lines: 195,
      desc: 'Recovers books from Google Takeout folders and ZIPs, fixes mislabeled formats and turns image-only PDFs into CBZ comics.',
      note: 'PDF steps shell out to poppler (pdfinfo, pdftotext, pdftoppm). On Android the bridge swaps these for PdfRenderer.',
      fields: [['text', 'Takeout export', 'Folder or ZIP', 'Downloads/takeout-20261002.zip'], ['switch', 'Convert image-only PDFs to CBZ', 'Lossless, page by page', true], ['switch', 'Repair mislabeled formats in the library', 'EPUBs named .pdf and the like', true]] },
    { id: 'scrubber', name: 'EPUB Promo Scrubber', version: '1.0.0', icon: 'cleaning_services', caps: ['Repair'], handoff: 'repair', core: 'scrubber_plugin/core.py', lines: 407,
      desc: 'Removes “Downloaded from…” lines, banner pages, site links and site names that download sites add to EPUBs.',
      note: 'Needs lxml, which Chaquopy ships as a prebuilt Android wheel.',
      fields: [['switch', 'Remove promo lines and banner pages', '', true], ['switch', 'Strip site names from metadata', '', true], ['switch', 'Keep the original', 'Saved as ORIGINAL_EPUB', true]] },
    { id: 'reddit', name: 'Reddit Story Follower', version: '1.7.1', icon: 'forum', caps: ['Follow', 'Download'], handoff: 'detail:oc', core: 'reddit/core.py', lines: 1012,
      desc: 'Follows Reddit series such as r/HFY as one EPUB per series that gains new chapters automatically.',
      note: 'Polling moves from “while Calibre is open” to a WorkManager job. “Log in with Reddit” uses a Custom Tab and an app link instead of a local web server.',
      fields: [['text', 'Subreddit, post or author', '', 'r/HFY · Out of Cruel Space'], ['seg', 'Source', 'Public feeds need no account', ['Public feed', 'Reddit API']], ['seg', 'Check for chapters', '', ['6 h', '12 h', 'Daily']], ['switch', 'Notify on new chapters', '', true]] },
    { id: 'gemini', name: 'Gemini Library Fixer', version: '1.2.0', icon: 'auto_fix_high', caps: ['Match', 'Tag'], handoff: 'match', core: 'gemini/engine.py', lines: 513,
      desc: 'Suggests cleaner titles, authors, series, tags, languages and ISBNs with Google Gemini, optionally by reading the covers.',
      note: 'Pure standard-library HTTP. The key lives in the Android Keystore; the review list becomes the Fix match screen.',
      fields: [['secret', 'Google AI Studio key', 'Free tier, paced automatically', '••••••••••••rT4k'], ['seg', 'Scope', '', ['Selected', 'Inbox', 'Whole library']], ['switch', 'Read front and back covers', '', true], ['switch', 'Leave big changes unticked', '', true]] },
    { id: 'media', name: 'Media Matcher', version: '1.0.0', icon: 'library_music', caps: ['Import', 'Match'], handoff: 'match:kob', core: 'media/matching.py · sources.py · tags.py', lines: 1318,
      desc: 'Brings music and audiobooks in with their tags and art, then matches them against MusicBrainz, Cover Art Archive and Open Library.',
      note: 'AcoustID fingerprinting calls the fpcalc binary; it stays optional until Chromaprint is built for Android.',
      fields: [['chips', 'Match against', '', ['MusicBrainz', 'Cover Art Archive', 'Open Library']], ['switch', 'Fingerprint unknown tracks', 'Needs an AcoustID key', false], ['switch', 'Leave uncertain matches unticked', '', true]] },
    { id: 'tagger', name: 'Story Collection Tagger', version: '1.0.0', icon: 'sell', caps: ['Tag'], handoff: 'tags', core: 'tagger/rules.py · fff_sites.py', lines: 285,
      desc: 'Tags books by source site (about 110 sites) and by keyword rules you write. Only adds tags, and previews first.',
      note: 'Rules map straight onto CleverFerret’s auto-tag rules.',
      fields: [['switch', 'Tag by source site', '110 sites recognised', true], ['text', 'Keyword rule', '', 'space opera → Space opera'], ['switch', 'Preview before applying', '', true]] },
    { id: 'fanfic', name: 'Fanfic Site Downloader', version: '1.0.0', icon: 'menu_book', caps: ['Download'], handoff: 'inbox', core: 'fanfic/engine.py + FanFicFare', lines: 197,
      desc: 'Downloads from Royal Road, Archive of Our Own and 100+ other sites as EPUB using FanFicFare’s site adapters.',
      note: 'FanFicFare is pure Python. FlareSolverr (needed by Royal Road) runs a headless browser, so it stays on a computer or NAS and the app points at its URL.',
      fields: [['text', 'Story address', '', 'https://archiveofourown.org/works/…'], ['switch', 'Allow adult sites', 'Off by default', false], ['text', 'FlareSolverr URL', 'Optional · on your network', 'http://nas.local:8191']] },
    { id: 'nifty', name: 'Nifty Downloader', version: '1.1.0', icon: 'collections_bookmark', caps: ['Download'], handoff: 'inbox', adult: true, core: 'nifty/core.py', lines: 645,
      desc: 'Downloads stories from the Nifty archive as EPUB by category, by author or by address, joining chapters into one book per series.',
      note: 'Adult archive: hidden until Settings → Parental allows 18+ sources.',
      fields: [['seg', 'Browse by', '', ['Category', 'Author', 'Addresses']], ['switch', 'One book per series', '', true]] },
    { id: 'metabods', name: 'Metabods Downloader', version: '1.0.0', icon: 'collections_bookmark', caps: ['Download'], handoff: 'inbox', adult: true, core: 'metabods/core.py', lines: 200,
      desc: 'Downloads stories from the Metabods archive as EPUB, searching by tag with saved favourites.',
      note: 'Adult archive: hidden until Settings → Parental allows 18+ sources.',
      fields: [['text', 'Search tags', '', ''], ['switch', 'Combine results into one book', '', false]] },
  ];
  // How plugins written for desktop calibre could run in the app, by plugin type.
  const PLUGIN_TIERS = [
    ['On device', 'phone_android', 'completed', 'Plugins whose logic is plain Python, like all nine above. Core runs under Chaquopy; a calibre shim maps about 20 library calls onto CleverFerret; the UI comes from a manifest.'],
    ['With a shim extension', 'extension', 'hiatus', 'Metadata-source plugins. They need calibre’s Source base class, its browser and lxml parsing. Feasible, but each plugin needs testing.'],
    ['Through a companion', 'dns', 'ongoing', 'Conversion, file-type, catalog and Edit Book plugins depend on calibre’s conversion engine and C extensions. Run them in calibre on a computer or NAS and send jobs from the phone.'],
    ['Port by hand', 'construction', 'failed', 'GUI-only actions built from Qt dialogs. No generic route; most overlap features the app already has (duplicates, stats, reading lists).'],
  ];
  const AUTO_TAG_RULES = [
    ['Source is r/HFY', 'Web fiction › HFY, Serial', true],
    ['Subject contains “space opera”', 'Fiction › Science fiction › Space opera', true],
    ['Movie runtime over 150 min', 'Long watch', false],
    ['Finished in under 3 days', 'Couldn’t put it down', true],
  ];

  // ─── Resolvers ─────────────────────────────────────────────────────────
  const gradOf = m => `linear-gradient(135deg, ${m[0]} 0%, ${m[1]} 45%, ${m[2]} 85%, ${m[3]} 100%)`;
  const px = v => v === 999 ? '999px' : v + 'px';
  const familyOf = id => (FAMILIES.find(f => f[1].includes(id)) || ['Other'])[0];
  const cache = {};

  function palette(id, opts) {
    const enforce = !opts || opts.enforce !== false;
    const key = id + (enforce ? '' : '~raw');
    if (cache[key]) return cache[key];
    const [name, s, light] = PALETTES[id];
    const raw = {}; s.split(' ').forEach((v, i) => { raw[KEYS[i]] = '#' + v.toUpperCase(); });
    const c = enforce ? contrast.enforcePaletteContrast(raw) : raw;
    const metal = METAL[id] || [mix(c.pri, '#000000', .45), c.pri, mix(c.pri, '#FFFFFF', .4), mix(c.pri, '#FFFFFF', .78)];
    const reader = {
      day: light ? { bg: c.surf, ink: c.ink } : { bg: mix('#FBF8F1', c.pri, .04), ink: '#1F1F1F' },
      sepia: { bg: mix('#F1E4C8', c.pri, .08), ink: '#4A3826' },
      night: light ? { bg: mix('#121212', c.pri, .06), ink: '#D9D4CA' } : { bg: c.bg, ink: c.ink },
    };
    if (id === 'eink') { reader.sepia = { bg: '#F2F2F2', ink: '#000000' }; reader.night = { bg: '#000000', ink: '#FFFFFF' }; }
    const base = id === 'contrast' ? STATUS_BASE.contrast : light ? STATUS_BASE.light : STATUS_BASE.dark;
    const status = { neutral: c.ink2 };
    for (const [k] of STATUS) if (k !== 'neutral') status[k] = id === 'eink' ? '#000000' : contrast.ensure(base[k], [c.surf, c.bg], 4.5);
    const player = {
      playButtonContainer: c.pri, playButtonIcon: c.onpri, controlIcon: c.ink, secondaryControlContainer: rgba(c.pri, .2),
      activeTrack: c.pri, inactiveTrack: rgba(c.ink, .24), thumb: c.pri, activeAccent: c.pri, surfaceOverlay: c.bg, sheetBackground: c.surf,
    };
    const out = { id, name, light: !!light, c, raw, metal, metalSrc: METAL[id] ? 'CFTokens.kt' : 'derived from primary', reader, status, player, clamp: CLAMPS[id] || null, family: familyOf(id) };
    cache[key] = out;
    return out;
  }

  // Apply palette clamps (E-Ink, High Contrast) on top of a requested theme.
  function effectiveTheme(theme) {
    const t = { ...DEFAULT_THEME, ...(theme || {}) };
    if (!LAYOUTS[t.layout]) t.layout = DEFAULT_THEME.layout;
    if (!PALETTES[t.palette]) t.palette = DEFAULT_THEME.palette;
    if (!EFFECTS[t.effect]) t.effect = DEFAULT_THEME.effect;
    const cl = CLAMPS[t.palette];
    if (cl) { if (cl.effect) t.effect = cl.effect; if (cl.motion) t.motion = cl.motion; }
    return t;
  }

  function prefersReducedMotion() {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Theme → CSS custom properties shared by every surface (cards, CTAs, nav, reader).
  function resolve(theme, opts) {
    opts = opts || {};
    const T = effectiveTheme(theme);
    const L = LAYOUTS[T.layout], P = palette(T.palette, { enforce: opts.enforce !== false }), E = EFFECTS[T.effect], c = P.c;
    const reduced = opts.reduced != null ? opts.reduced : prefersReducedMotion();
    const motionOn = T.motion === 'on' || (T.motion === 'system' && !reduced);
    const grad = gradOf(P.metal);
    const metal = E.cta ? grad : `linear-gradient(${c.pri}, ${c.pri})`;
    const ctafg = pickInk(E.cta ? P.metal[1] : c.pri, [c.onpri, c.ink, c.bg]);
    const glowC = rgba(c.pri, .55);
    const onpriL = pickInk(c.pri, [c.bg, c.onpri, c.ink]);
    const onPriC = pickInk(c.priC, [c.onpriC, c.ink, c.bg]);

    // Card treatment per layout pack (linkpoint look.js), expressed per side.
    const hair = `1px solid ${c.outv}`;
    let cb = { t: 'none', r: 'none', b: 'none', l: 'none' }, cbg = c.surf, csh = 'none';
    if (L.card === 'compose' || L.card === 'box') cb = { t: hair, r: hair, b: hair, l: hair };
    if (L.card === 'flat') cb.l = '4px solid transparent';
    if (L.card === 'soft') csh = P.light ? '0 2px 10px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.7)' : '0 3px 12px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.16)';
    if (L.card === 'rule') { cb.t = hair; cbg = 'transparent'; }
    if (L.card === 'quiet') { cb.b = hair; cbg = 'transparent'; }
    if (L.card === 'lcars') cbg = c.surf2;
    const filled = cbg !== 'transparent';
    let surfC = L.card === 'lcars' ? c.surf2 : c.surf;
    if (E.glass && filled) { surfC = rgba(surfC, .6); cbg = surfC; }
    if (E.gborder && filled) { cb = { t: '1px solid transparent', r: '1px solid transparent', b: '1px solid transparent', l: '1px solid transparent' }; cbg = `linear-gradient(${surfC}, ${surfC}) padding-box, ${grad} border-box`; }
    if (E.glow) csh = (csh === 'none' ? '' : csh + ', ') + `0 0 14px ${rgba(c.pri, .28)}`;
    const soft2 = `linear-gradient(135deg, ${E.glass ? rgba(c.surf2, .6) : c.surf2}, ${surfC})`;
    const herobg = L.card === 'compose' && !E.gborder ? soft2 : cbg;
    const tiles = L.nav === 'tiles';
    const qOnPri = pickInk(c.pri, [c.onpri, c.ink, c.bg]);

    let bgimg = '';
    const dot = P.light ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.06)';
    if (E.bg === 'aurora') bgimg = `radial-gradient(120% 55% at 0% 0%, ${rgba(c.sec, .32)}, transparent 62%), radial-gradient(90% 50% at 100% 35%, ${rgba(c.pri, .22)}, transparent 60%), `;
    if (E.bg === 'pattern') bgimg = `repeating-linear-gradient(45deg, ${rgba(c.pri, .08)} 0 1px, transparent 1px 18px), repeating-linear-gradient(-45deg, ${rgba(c.pri, .08)} 0 1px, transparent 1px 18px), `;
    if (E.bg === 'noise') bgimg = `radial-gradient(${dot} 1px, transparent 1.3px) 0 0/4px 4px, `;

    const R = P.reader[opts.reader || 'sepia'];
    const vars = {
      '--bg': c.bg, '--surf': c.surf, '--surf2': c.surf2, '--ink': c.ink, '--ink2': c.ink2, '--pri': c.pri, '--onpri': c.onpri, '--priC': c.priC, '--onpriC': onPriC,
      '--outv': c.outv, '--sec': c.sec, '--sec2': c.sec2, '--err': c.err,
      '--onpriL': onpriL, '--onsec2L': pickInk(c.sec2, [c.bg, c.ink]), '--onsecL': pickInk(c.sec, [c.bg, c.ink]),
      '--pbg': bgimg + c.bg, '--bgimg': bgimg || 'none',
      '--metal': metal, '--ctafg': ctafg, '--ctash': E.glow ? `0 0 18px ${glowC}` : 'none', '--wglow': E.glow ? `drop-shadow(0 0 6px ${rgba(c.pri, .6)})` : 'none',
      '--shim': motionOn && E.shimmer ? 'cfShimmer 2.8s linear infinite' : 'none', '--shimo': E.shimmer ? 1 : 0,
      '--pulse': motionOn && E.pulse ? 'cfPulse 2.4s ease-in-out infinite' : 'none',
      '--enter': motionOn ? 'cfIn .2s cubic-bezier(.05,.7,.1,1)' : 'none', '--skelAnim': motionOn ? 'cfSkel 1.4s ease-in-out infinite' : 'none',
      '--press': motionOn ? 'scale(.97)' : 'none', '--bf': E.glass ? 'blur(14px) saturate(180%)' : 'none',
      '--ff': L.ff, '--dff': L.dff, '--lf': L.lf, '--tt': L.tt, '--htls': L.htls, '--tw': L.tw,
      '--hdls': T.layout === 'rules' ? '.08em' : T.layout === 'terminal' ? '.06em' : L.htls,
      '--rl': px(L.rl), '--rp': px(L.rp), '--rt': px(L.rt), '--rc': px(L.rc), '--rs': px(L.rs), '--ri': px(L.ri), '--ra': px(L.ra),
      '--cbt': cb.t, '--cbr': cb.r, '--cbb': cb.b, '--cbl': cb.l, '--cbg': cbg, '--csh': csh, '--herobg': herobg, '--fbg': herobg,
      '--qbg': tiles ? c.pri : herobg, '--qfg': tiles ? qOnPri : c.ink, '--qic': tiles ? qOnPri : c.pri,
      '--qbt': tiles ? 'none' : cb.t, '--qbr': tiles ? 'none' : cb.r, '--qbb': tiles ? 'none' : cb.b, '--qbl': tiles ? 'none' : cb.l,
      '--qsh': tiles && E.glow ? `0 0 16px ${glowC}, inset 0 0 12px rgba(255,255,255,.18)` : csh,
      '--qalign': tiles || L.nav === 'sweep' ? 'flex-start' : 'center', '--qjust': tiles || L.nav === 'sweep' ? 'space-between' : 'center', '--qgap': L.qgap,
      '--track': rgba(c.ink, .14), '--hover': rgba(c.ink, .06), '--skel': rgba(c.ink, .09), '--scrim': 'rgba(0,0,0,.6)',
      '--mpbg': E.glass ? rgba(c.surf, .75) : (L.nav === 'sweep' ? c.surf2 : c.surf),
      '--navbg': E.glass ? rgba(c.surf, .65) : c.surf, '--navbt': L.card === 'rule' || L.card === 'quiet' ? hair : 'none', '--navbr': L.card === 'rule' || L.card === 'quiet' ? hair : 'none',
      '--focus': P.id === 'contrast' ? '#00FFFF' : c.pri, '--hair': rgba(c.outv, .7),
      // Primary used as text (kind labels, links, counts) must clear 4.5:1 on every surface it sits on.
      '--priText': contrast.ensure(c.pri, [c.surf, c.bg, c.surf2], 4.5),
      '--rpbg': R.bg, '--rpink': R.ink, '--rpmuted': mix(R.ink, R.bg, .35), '--rff': T.layout === 'terminal' ? '"JetBrains Mono",monospace' : '"Source Serif 4",Georgia,serif',
    };
    for (const [k] of STATUS) vars['--st-' + k] = P.status[k];
    return { T, L, P, E, c, vars, grad, metal, ctafg, glowC, onpriL, onPriC, qOnPri, bgimg, motionOn, reduced, hair, clamped: !!P.clamp, requested: { ...DEFAULT_THEME, ...(theme || {}) } };
  }

  // Contrast pairs that matter for a palette, used by the spec audit and tests.
  function auditPairs(c) {
    return [
      ['onSurface on background', 'ink', 'bg', 4.5], ['onSurface on surface', 'ink', 'surf', 4.5],
      ['onSurfaceVariant on background', 'ink2', 'bg', 4.5], ['onSurfaceVariant on surface', 'ink2', 'surf', 4.5],
      ['onPrimary on primary', 'onpri', 'pri', 4.5], ['onPrimaryContainer on primaryContainer', 'onpriC', 'priC', 4.5],
      ['primary on background', 'pri', 'bg', 3.0], ['secondary on background', 'sec', 'bg', 3.0],
      ['outlineVariant on background', 'outv', 'bg', 3.0], ['error on background', 'err', 'bg', 3.0],
    ].map(([label, fg, bg, min]) => { const r = ratio(c[fg], c[bg]); return { label, fg, bg, min, ratio: r, pass: r >= min, aaa: r >= 7 }; });
  }

  const themeId = t => { const T = effectiveTheme(t); return `${T.layout}__${PALETTES[T.palette][0].toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}__${T.effect}`; };

  const CF = {
    version: '2.0.0',
    hx, toHex, mix, rgba, ratio, pickInk, gradOf, px, contrast,
    KEYS, ROLE_NAMES, PALETTES, FAMILIES, METAL, CLAMPS, STATUS, LAYOUTS, EFFECTS,
    TYPE, SPACE, GUTTERS, RADIUS, MOTION, CONTRAST, CATALOG, SCREENS, DEFAULT_THEME,
    PIPELINE, CONFIDENCE, confidenceOf, SEVERITY, FIXES, AGENTS, INBOX, CANDIDATES, MATCH_FIELDS, NAMING, templateParts, applyTemplate, TAG_SOURCES, TAG_GROUPS, AUTO_TAG_RULES, PLUGINS, PLUGIN_TIERS,
    palette, effectiveTheme, resolve, auditPairs, themeId, prefersReducedMotion,
    byId: id => CATALOG.find(x => x.id === id),
    counts: { layouts: Object.keys(LAYOUTS).length, palettes: Object.keys(PALETTES).length, effects: Object.keys(EFFECTS).length, screens: SCREENS.length },
  };

  root.CF = CF;
  // Kept for pages that still read the old global name.
  root.WCAGContrastEngine = contrast;
  if (typeof module !== 'undefined' && module.exports) module.exports = CF;
})(typeof window !== 'undefined' ? window : globalThis);
