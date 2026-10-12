// WCAG 2.2 AA audit of every colour pack, using the same module the pages ship (docs/cf-system.js).
// Run: node tests/verify_contrast.js
const path = require("path");
const CF = require(path.join(__dirname, "../docs/cf-system.js"));

let failures = 0,
  checks = 0;
const fail = (msg) => {
  failures++;
  console.error("[FAIL] " + msg);
};
const check = (ok, msg) => {
  checks++;
  if (!ok) fail(msg);
};

console.log("WCAG 2.2 AA contrast audit");
for (const id of Object.keys(CF.PALETTES)) {
  const P = CF.palette(id);
  const c = P.c;
  for (const pair of CF.auditPairs(c))
    check(
      pair.pass,
      `${P.name}: ${pair.label} ${pair.ratio.toFixed(2)}:1 < ${pair.min}:1`
    );

  // Status colours appear as small text and icons on surfaces.
  for (const [k] of CF.STATUS)
    check(
      CF.ratio(P.status[k], c.surf) >= 4.5,
      `${P.name}: status ${k} ${P.status[k]} on surface`
    );

  // Reader pages are body text.
  for (const [mode, page] of Object.entries(P.reader))
    check(CF.ratio(page.ink, page.bg) >= 4.5, `${P.name}: reader ${mode} page`);

  // Theme-derived text roles: primary used as text, the metal CTA label, and the selected nav pill.
  for (const effect of Object.keys(CF.EFFECTS)) {
    const R = CF.resolve(
      { layout: "compose", palette: id, effect },
      { reduced: true }
    );
    const stops = R.E.cta ? R.ctaStops : [c.pri, c.pri];
    // Interpolate between stops, rather than checking only a gradient's base colour.
    for (let i = 1; i < stops.length; i++)
      for (let n = 0; n <= 32; n++) {
        const bg = CF.mix(stops[i - 1], stops[i], n / 32);
        check(
          CF.ratio(R.ctafg, bg) >= 4.5,
          `${P.name}/${effect}: CTA gradient at ${i}:${n}`
        );
      }
    for (const bg of R.readingSurfaces) {
      for (const role of [
        "--priText",
        "--ink",
        "--ink2",
        ...CF.STATUS.map(([k]) => "--st-" + k),
      ]) {
        check(
          CF.ratio(R.vars[role], bg) >= 4.5,
          `${P.name}/${effect}: ${role} on ${bg}`
        );
      }
      if (R.E.cta)
        for (let i = 1; i < R.textStops.length; i++)
          for (let n = 0; n <= 32; n++) {
            const ink = CF.mix(R.textStops[i - 1], R.textStops[i], n / 32);
            check(
              CF.ratio(ink, bg) >= 4.5,
              `${P.name}/${effect}: metal text gradient at ${i}:${n} on ${bg}`
            );
          }
    }
    check(
      CF.ratio(R.onPriC, c.priC) >= 4.5,
      `${P.name}: nav pill label on primaryContainer`
    );
  }
}

console.log(
  `Packs: ${
    Object.keys(CF.PALETTES).length
  } · checks: ${checks} · failures: ${failures}`
);
if (failures) {
  console.error("FAILURE: contrast violations found.");
  process.exit(1);
}
console.log("SUCCESS: every colour pack meets WCAG 2.2 AA.");
