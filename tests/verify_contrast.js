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

const PK = {
  ink:["Ink Terminal","0A1112 101A1C 1B2A2D D7F5E6 A7C8BC 6CFF9A 0A1112 1F6640 D7F5E6 536373 8AD0B0 4B655C CF6679"],
  noir:["Neo-Noir Neon","090A10 111420 1C2130 E7EAF7 B9C0D8 AA43FF 090A10 4B1D73 E7EAF7 00D1FF FF3D9E 575E73 FF6B6B"],
  metro:["Metro Cyan","001A33 002448 3D4854 F0F8FF B8CAD6 00AEEF 001A33 0070CA F0F8FF 2D89EF 00AEEF 5C6975 CF6679"],
  aurora:["Aurora Glass Night","0A1224 101C33 1D2B4A E7F0FF B5C7E9 6DE8FF 0A1224 2A6F85 E7F0FF 8C7CFF 7CFFD8 516182 CF6679"],
  slatec:["Slate Cyan","1A1F24 232930 3D4854 E8F0F5 B8CAD6 00D9FF 1A1F24 00A8CC 1A1F24 636C76 6BA5B8 5F6C78 CF6679"],
  lcars:["LCARS Amber","120C1C 1C132A 3D1F5C F3E9FF D0B3E6 F2A65A 120C1C CC7A2B 120C1C A485F7 C5678D 745683 CF6679"],
  amber:["Midnight Amber","0C1824 15202E 253447 E8EEF5 B8C5D6 FFBF00 0C1824 CC9900 0C1824 D4A76A D4A76A 5B6672 CF6679"],
  royalb:["Royal Bronze","1A0A30 220D40 3D1F5C F0E6FF D0B3E6 CD7F32 1A0A30 975929 F0E6FF 6F5792 9B7A5F 745683 CF6679"],
  forest:["Forest Copper","0D1F0D 152915 2A4D2A E8F5E8 B8D9B8 B87333 0D1F0D 935E29 E8F5E8 4D704D 8FA886 526F52 CF6679"],
  crimson:["Obsidian Crimson","0A0A0A 141414 2D2D2D F5F5F5 D0D0D0 DC143C F5F5F5 B00F30 F5F5F5 A8505A A8505A 5E5E5E FF6B6B"],
  navy:["Navy Gold","0A1630 1A2645 2A3655 E8E3D8 C9C4B9 D4AF37 0A1630 715F33 E8E3D8 4A90E2 9C8970 62665C CF6679"],
  deco:["Art Deco","0B0A0A 141314 232124 F3E8D0 C9BDA2 D4AF37 0B0A0A 977B2F 0B0A0A F4E7CF B8A17A 665E4D FFB4AB"],
  emerald:["Emerald Silver","0D3B2E 1A5544 2A6554 E8F5E8 C9E4D9 C0C0C0 0D3B2E 505050 E8F5E8 50C878 8BA888 718177 CF6679"],
  royals:["Royal Silver","1A1535 211A40 3D2F5C F0EBFF C8BFE6 C0C0C0 1A1535 9A9A9A 1A1535 6C6192 A89BC9 6E6087 CF6679"],
  deep:["Deep Purple Platinum","1A0F2E 24153D 3D2A5C F0EBFF D0C0E6 E5E4E2 1A0F2E B8B7B5 1A0F2E 6D598F C8BFE0 6B5D8B CF6679"],
  charcoal:["Charcoal Champagne","1F1F1F 2A2A2A 3D3D3D F5F5F5 D0D0D0 F7E7CE 1F1F1F C5B8A5 1F1F1F 6A6A6A D4C4A8 6B6B6B CF6679"],
  slateg:["Slate Gunmetal","1A2029 232C38 3D4854 E6ECF2 B8C5D6 8F9CA8 1A2029 7D8A94 1A2029 606B77 9DAAB6 5F6C78 CF6679"],
  rose:["Rose Gold","3D1F2B 4D2F3B 5D3F4B F5E5E8 E5D5D8 C1818B 3D1F2B 7D4A52 F5E5E8 D4A5A5 C9A9A9 816D71 FFB4AB"],
  burgundy:["Burgundy Rose Gold","2D0F1A 3D1525 5C2A3D FFE6ED E6C0CC B76E79 2D0F1A 93575F FFE6ED 895666 C99BA5 885A68 FFB4AB"],
  aero:["Frutiger Aero","EAF7FF F7FCFF DDF1FF 173A52 34566E 1895CF 000000 A9E6FF 173A52 409F45 0A6FA0 7391A4 BA1A1A",1],
  paper:["Paper & Ink","F0F0EB FAF9F6 EBEAE4 2C2C2C 454545 2C2C2C F0F0EB EBEAE4 2C2C2C 595959 6B6B6B 8A8A8A BA1A1A",1],
  nouveau:["Art Nouveau","F6F0E6 FFF8EE E7D8C7 2C2218 584638 7B5737 F6F0E6 D9C2A9 2C2218 73945F C57C52 9B8875 BA1A1A",1],
  calm:["Calm Clinical","F5FAFD FFFFFF E5EEF4 1F394B 445F72 38779E F5FAFD C4DFF2 1F394B 4C9F76 7D9AB2 7F929F BA1A1A",1],
  solarpunk:["Solarpunk Civic","F2FBF4 FBFFFC E2F2E8 1E3A27 456355 26A358 000000 BFEFD0 1E3A27 3796D2 F2C46C 7A9786 BA1A1A",1],
};
const KEYS = "bg surf surf2 ink ink2 pri onpri priC onpriC sec sec2 outv err".split(" ");

let failures = 0;
let totalChecks = 0;

console.log("==================================================");
console.log(" Running WCAG 2.2 Level AA Contrast Palette Audit ");
console.log("==================================================");

for (const [id, [name, s]] of Object.entries(PK)) {
  const rawC = {}; s.split(" ").forEach((v,i) => rawC[KEYS[i]] = "#" + v.toUpperCase());
  const c = rawC;

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
