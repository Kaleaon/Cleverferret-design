// Check the web tokens against the immutable Ktheme layout standards v1 artifact.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const CF = require('../docs/cf-system.js');
const data = fs.readFileSync(require.resolve('../docs/standards/layouts.v1.json'));
const contract = JSON.parse(data);
assert.equal(crypto.createHash('sha256').update(data).digest('hex'), 'b97b50d7422fe74e54221e9a7b17dc0fb94930483d2eb7a0c7e5913648e859a3');
assert.equal(contract.version, 1);
assert.deepEqual(Object.keys(CF.LAYOUTS), Object.keys(contract.layouts));
const cornerTokens = { large: 'rl', panel: 'rp', tile: 'rt', cover: 'rc', control: 'rs', icon: 'ri', artwork: 'ra' };
for (const [id, standard] of Object.entries(contract.layouts)) {
  const layout = CF.LAYOUTS[id];
  assert.equal(standard.id, id);
  for (const [role, token] of Object.entries(cornerTokens)) assert.equal(layout[token], standard.corners[role], `${id}/${role}`);
  assert.equal(layout.fontName, standard.typography.body, `${id} font family`);
  assert.equal(layout.card, standard.surfaces, `${id} surface treatment`);
}
for (const key of ['rail', 'bar', 'gap', 'inner', 'arm', 'header', 'elbow', 'footer']) {
  assert.equal(CF.LCARS.frame[key], contract.layouts.sweep.frame[key], `LCARS ${key}`);
}
const geometry = CF.lcarsGeometry();
assert.equal(geometry.outerX, 94);
assert.equal(geometry.outerY, 30);
assert.equal(geometry.headerBottom - geometry.outerY, 86);
assert.equal(geometry.shellTop + geometry.inner, 150);
assert.equal(contract.common.minimumTarget, 48);
console.log('Seven web layouts match the published Ktheme v1 contract and LCARS geometry.');
