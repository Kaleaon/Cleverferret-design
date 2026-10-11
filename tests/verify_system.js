// Structural checks for the design system data and the pages that consume it.
// Run: node tests/verify_system.js
const fs = require('fs');
const path = require('path');
const CF = require(path.join(__dirname, '../docs/cf-system.js'));
const docs = f => fs.readFileSync(path.join(__dirname, '../docs', f), 'utf8');

let failures = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) { failures++; console.error('[FAIL] ' + msg); } };
const HEX = /^#[0-9A-F]{6}$/i;

// Colour packs
for (const [id, [name, roles, light]] of Object.entries(CF.PALETTES)) {
  const parts = roles.split(' ');
  check(parts.length === CF.KEYS.length, `${id}: expected ${CF.KEYS.length} roles, got ${parts.length}`);
  check(parts.every(h => HEX.test('#' + h)), `${id}: invalid hex in roles`);
  check(typeof name === 'string' && name.length > 0, `${id}: missing name`);
  check(light === undefined || light === 1, `${id}: light flag must be 1 or absent`);
}
const famIds = CF.FAMILIES.flatMap(f => f[1]);
check(famIds.length === new Set(famIds).size, 'a pack appears in more than one family');
for (const id of Object.keys(CF.PALETTES)) check(famIds.includes(id), `${id}: not in any family`);
for (const id of famIds) check(!!CF.PALETTES[id], `family lists unknown pack ${id}`);
for (const [id, stops] of Object.entries(CF.METAL)) check(stops.length === 4 && stops.every(h => HEX.test(h)), `${id}: metal needs 4 hex stops`);
for (const id of Object.keys(CF.CLAMPS)) check(!!CF.PALETTES[id], `clamp for unknown pack ${id}`);

// Layout and effect packs
const LAYOUT_KEYS = ['name', 'nav', 'navSpec', 'fontName', 'ff', 'dff', 'lf', 'rl', 'rp', 'rt', 'rc', 'rs', 'ri', 'ra', 'tt', 'htls', 'tw', 'card', 'qgap', 'desc', 'note'];
for (const [id, l] of Object.entries(CF.LAYOUTS)) for (const k of LAYOUT_KEYS) check(l[k] !== undefined, `layout ${id}: missing ${k}`);
for (const [id, e] of Object.entries(CF.EFFECTS)) check(Array.isArray(e.slots) && e.slots.length === 6, `effect ${id}: needs 6 slots`);

// Every combination resolves to a complete set of CSS variables
for (const layout of Object.keys(CF.LAYOUTS)) for (const palette of Object.keys(CF.PALETTES)) for (const effect of Object.keys(CF.EFFECTS)) {
  const R = CF.resolve({ layout, palette, effect, motion: 'system' }, { reduced: false });
  const bad = Object.entries(R.vars).filter(([, v]) => v === undefined || v === null || String(v).includes('undefined') || String(v).includes('NaN'));
  check(bad.length === 0, `${layout}/${palette}/${effect}: bad vars ${bad.map(b => b[0]).join(', ')}`);
  if (CF.CLAMPS[palette] && CF.CLAMPS[palette].effect) check(R.T.effect === CF.CLAMPS[palette].effect, `${palette} should lock effect`);
}

// Screens: registry, app template and logic agree
const app = docs('app.dc.html');
for (const s of CF.SCREENS) {
  const flag = 's' + s.id.charAt(0).toUpperCase() + s.id.slice(1);
  check(app.includes(`{{ ${flag} }}`), `app.dc.html: no template block for screen ${s.id} (${flag})`);
  check(app.includes(`${flag}: screen === '${s.id}'`), `app.dc.html: no ${flag} flag in renderVals`);
}

// Library management data
for (const it of CF.INBOX) {
  check(!!CF.NAMING[it.lib], `inbox ${it.id}: unknown library ${it.lib}`);
  for (const f of it.fixes) check(!!CF.FIXES[f], `inbox ${it.id}: unknown fix ${f}`);
  check(it.conf >= 0 && it.conf <= 100, `inbox ${it.id}: confidence out of range`);
}
for (const [id, [sev]] of Object.entries(CF.FIXES)) check(!!CF.SEVERITY[sev], `fix ${id}: unknown severity ${sev}`);
const sample = { books: 'tbp', audiobooks: 'rec', comics: 'saga', movies: 'arr', tv: 'tz', music: 'kob', webfiction: 'hfy' };
for (const [lib, n] of Object.entries(CF.NAMING)) for (const [, , tpl] of n.options) {
  const out = CF.applyTemplate(tpl, CF.INBOX.find(x => x.id === sample[lib]).vals);
  check(!/[{}]/.test(out) && !out.includes('//'), `naming ${lib}: template leaves gaps: ${out}`);
}
for (const [, , tags] of CF.TAG_GROUPS) for (const [, , src] of tags) check(!!CF.TAG_SOURCES[src], `tag source ${src} unknown`);

// Calibre plugin manifests
const FIELD_TYPES = ['switch', 'text', 'secret', 'seg', 'chips'];
for (const p of CF.PLUGINS) {
  check(/^\d+\.\d+\.\d+$/.test(p.version), `plugin ${p.id}: bad version`);
  for (const f of p.fields) check(FIELD_TYPES.includes(f[0]), `plugin ${p.id}: unknown field type ${f[0]}`);
  const target = p.handoff.split(':')[0];
  check(target === 'detail' || CF.SCREENS.some(s => s.id === target), `plugin ${p.id}: hands off to unknown screen ${target}`);
}

// LCARS conformance is documented
check(CF.LCARS.deviations.some(d => d[1] === 'Overlay on a bar'), 'LCARS: overlay-on-a-bar deviation must stay documented');
const frame = CF.lcarsGeometry();
// The header's bottom-left outer/inner curves share both coordinates of their center.
check(frame.outerX === frame.rail + frame.inner, 'LCARS header: horizontal curve centers differ');
check(frame.headerBottom - frame.outerY === frame.headerTop + frame.header - frame.bar - frame.inner, 'LCARS header: vertical curve centers differ');
// The content's top-left curve uses the same center as the content cutout.
check(frame.contentTop + frame.outerY === frame.shellTop + frame.inner, 'LCARS content: vertical curve centers differ');
check(frame.contentTop - frame.headerBottom === frame.gap, 'LCARS: opposing bars need a black gap');
check(CF.palette('lcars').c.bg === '#000000', 'LCARS reference field must be black');

// Pages load the shared module and kit
for (const f of ['app.dc.html', 'theme-system.dc.html']) {
  const html = docs(f);
  check(html.includes('src="./cf-system.js"'), `${f}: does not load cf-system.js`);
  check(html.includes('href="cf-ui.css"'), `${f}: does not load cf-ui.css`);
  check(/<html lang="en">/.test(html), `${f}: missing lang`);
}
check(docs('index.html').includes('src="cf-system.js"'), 'index.html: does not load cf-system.js');

console.log(`System checks: ${checks} · failures: ${failures}`);
if (failures) process.exit(1);
console.log('SUCCESS: design system data and pages are consistent.');
