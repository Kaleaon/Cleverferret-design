import assert from 'node:assert/strict';
import pngjs from 'pngjs';
import { comparePNGBuffers } from '../tools/png-compare.mjs';
const { PNG } = pngjs;
const sample = new PNG({ width: 16, height: 16 });
for (let i = 0; i < sample.data.length; i += 4) {
  sample.data[i] = i % 255; sample.data[i + 1] = 120;
  sample.data[i + 2] = 60; sample.data[i + 3] = 255;
}
const unfiltered = PNG.sync.write(sample, { filterType: 0 });
const filtered = PNG.sync.write(sample, { filterType: 4 });
assert.ok(!unfiltered.equals(filtered), 'Fixtures use different encodings');
assert.equal(comparePNGBuffers(unfiltered, filtered).diffPercent, 0, 'Encoding must not create a visual regression');
sample.data.fill(255);
assert.equal(comparePNGBuffers(unfiltered, PNG.sync.write(sample)).match, false, 'A visible color change must fail');
assert.equal(comparePNGBuffers(unfiltered, PNG.sync.write(new PNG({ width: 8, height: 8 }))).match, false, 'A size change must fail');
assert.throws(() => comparePNGBuffers(unfiltered, Buffer.from('bad png')), 'Invalid images must not silently match');
console.log('SUCCESS: visual comparison ignores encoding and detects pixel/size changes.');
