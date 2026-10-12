import pngjs from "pngjs";
const { PNG } = pngjs;

// Compare decoded RGBA pixels. PNG row filters and compression are encoding details.
export function comparePNGBuffers(bufA, bufB, colorThreshold = 15) {
  const a = PNG.sync.read(bufA),
    b = PNG.sync.read(bufB);
  if (a.width !== b.width || a.height !== b.height) {
    return {
      match: false,
      diffPercent: 100,
      reason: `Dimension mismatch (${a.width}x${a.height} vs ${b.width}x${b.height})`,
    };
  }
  const totalPixels = a.width * a.height;
  let diffPixels = 0;
  for (let px = 0; px < a.data.length; px += 4) {
    if (
      [0, 1, 2, 3].some(
        (channel) =>
          Math.abs(a.data[px + channel] - b.data[px + channel]) > colorThreshold
      )
    )
      diffPixels++;
  }
  const diffPercent = (diffPixels / totalPixels) * 100;
  return {
    match: diffPercent <= 0.1,
    diffPercent: Number(diffPercent.toFixed(3)),
    diffPixels,
    totalPixels,
  };
}
