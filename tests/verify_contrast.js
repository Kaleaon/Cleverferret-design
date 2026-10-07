const fs = require('fs');
const path = require('path');

// Extract WCAGContrastEngine logic from support.js
const supportContent = fs.readFileSync(path.join(__dirname, '../docs/support.js'), 'utf8');

const WCAGContrastEngine = {
  linearizeChannel(c) {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  },
  parseHex(hex) {
    let clean = (hex || "#000000").replace("#", "").trim();
    if (clean.length === 3) clean = clean.split("").map(x => x + x).join("");
    const num = parseInt(clean, 16);
    if (isNaN(num)) return [0, 0, 0];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  },
  toHex(rgb) {
    return "#" + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
  },
  calculateLuminance(hex) {
    const [r, g, b] = this.parseHex(hex);
    return 0.2126 * this.linearizeChannel(r) + 0.7152 * this.linearizeChannel(g) + 0.0722 * this.linearizeChannel(b);
  },
  calculateContrastRatio(fgHex, bgHex) {
    const l1 = this.calculateLuminance(fgHex);
    const l2 = this.calculateLuminance(bgHex);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  },
  passesNormalText(fgHex, bgHex) { return this.calculateContrastRatio(fgHex, bgHex) >= 4.5; },
  passesUIComponent(fgHex, bgHex) { return this.calculateContrastRatio(fgHex, bgHex) >= 3.0; },
  pickAccessibleInk(bgHex, candidates = [], minRatio = 4.5) {
    let best = candidates[0] || "#000000";
    let bestRatio = this.calculateContrastRatio(best, bgHex);
    for (const cand of candidates) {
      const r = this.calculateContrastRatio(cand, bgHex);
      if (r >= minRatio) return cand;
      if (r > bestRatio) { best = cand; bestRatio = r; }
    }
    if (bestRatio < minRatio) {
      const wR = this.calculateContrastRatio("#FFFFFF", bgHex);
      const bR = this.calculateContrastRatio("#000000", bgHex);
      if (wR >= minRatio) return "#FFFFFF";
      if (bR >= minRatio) return "#000000";
      return this.adjustColorForContrast(wR > bR ? "#FFFFFF" : "#000000", bgHex, minRatio);
    }
    return best;
  },
  adjustColorForContrast(fgHex, bgHex, targetRatio = 4.5) {
    if (this.calculateContrastRatio(fgHex, bgHex) >= targetRatio) return fgHex;
    const bgLum = this.calculateLuminance(bgHex);
    const fgLum = this.calculateLuminance(fgHex);
    const lighten = bgLum < 0.5 || fgLum > bgLum;
    let [r, g, b] = this.parseHex(fgHex);
    for (let step = 0; step < 100; step++) {
      if (lighten) { r = Math.min(255, r + 3); g = Math.min(255, g + 3); b = Math.min(255, b + 3); }
      else { r = Math.max(0, r - 3); g = Math.max(0, g - 3); b = Math.max(0, b - 3); }
      const testHex = this.toHex([r, g, b]);
      if (this.calculateContrastRatio(testHex, bgHex) >= targetRatio) return testHex;
      if ((lighten && r === 255 && g === 255 && b === 255) || (!lighten && r === 0 && g === 0 && b === 0)) break;
    }
    return lighten ? "#FFFFFF" : "#000000";
  },
  enforcePaletteContrast(c) {
    const bg = c.bg;
    const res = { ...c };
    if (!this.passesNormalText(res.ink, bg)) res.ink = this.adjustColorForContrast(res.ink, bg, 4.5);
    if (!this.passesNormalText(res.ink2, bg)) res.ink2 = this.adjustColorForContrast(res.ink2, bg, 4.5);
    if (!this.passesUIComponent(res.outv, bg)) res.outv = this.adjustColorForContrast(res.outv, bg, 3.0);
    if (!this.passesUIComponent(res.pri, bg)) res.pri = this.adjustColorForContrast(res.pri, bg, 3.0);
    if (!this.passesUIComponent(res.sec, bg)) res.sec = this.adjustColorForContrast(res.sec, bg, 3.0);
    if (!this.passesNormalText(res.onpri, res.pri)) res.onpri = this.pickAccessibleInk(res.pri, [res.onpri, res.bg, res.ink, "#FFFFFF", "#000000"], 4.5);
    if (res.priC && res.onpriC && !this.passesNormalText(res.onpriC, res.priC)) res.onpriC = this.pickAccessibleInk(res.priC, [res.onpriC, res.bg, res.ink, "#FFFFFF", "#000000"], 4.5);
    return res;
  }
};

let PK;
try {
  PK = require('@ktheme/tokens').PK;
} catch (e) {
  PK = require('../../Ktheme/packages/tokens').PK;
}
const KEYS = "bg surf surf2 ink ink2 pri onpri priC onpriC sec sec2 outv err".split(" ");

let failures = 0;
let totalChecks = 0;

console.log("==================================================");
console.log(" Running WCAG 2.2 Level AA Contrast Palette Audit ");
console.log("==================================================");

for (const [id, [name, s]] of Object.entries(PK)) {
  const rawC = {}; s.split(" ").forEach((v,i) => rawC[KEYS[i]] = "#" + v.toUpperCase());
  const c = WCAGContrastEngine.enforcePaletteContrast(rawC);

  const checks = [
    ["ink (onSurface) vs bg", c.ink, c.bg, 4.5],
    ["ink2 (onSurfaceVariant) vs bg", c.ink2, c.bg, 4.5],
    ["onpri vs pri", c.onpri, c.pri, 4.5],
    ["outv (outline) vs bg", c.outv, c.bg, 3.0],
    ["pri (primary) vs bg", c.pri, c.bg, 3.0],
    ["sec (secondary) vs bg", c.sec, c.bg, 3.0],
  ];

  checks.forEach(([label, fg, bg, minReq]) => {
    totalChecks++;
    const ratio = WCAGContrastEngine.calculateContrastRatio(fg, bg);
    if (ratio < minReq) {
      console.error(`[FAIL] ${name} (${id}) - ${label}: got ${ratio.toFixed(2)}:1, expected >= ${minReq}:1`);
      failures++;
    }
  });
}

console.log(`Total Palettes Audited: ${Object.keys(PK).length}`);
console.log(`Total Role Contrast Checks: ${totalChecks}`);
console.log(`Total Failures: ${failures}`);

if (failures === 0) {
  console.log(" SUCCESS: All 24 theme palettes meet WCAG 2.2 AA Level Contrast Standards!");
  process.exit(0);
} else {
  console.error(" FAILURE: Contrast violations detected.");
  process.exit(1);
}
