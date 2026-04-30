// One-shot: generate Play-Store-ready PNG icons from the RepLab logo.
// Outputs to client/public/:
//   icon-192.png           — small "any" purpose, ~5% padding
//   icon-512.png           — large "any" purpose, ~5% padding
//   icon-maskable-512.png  — maskable purpose, logo confined to inner
//                             70% (safe zone) so OS-side circle/squircle
//                             crops never clip the wordmark.
//
// Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'client/public/RepLaplogo3NoBG.jpg');
const OUT = path.join(ROOT, 'client/public');

// Brand-black background so the logo's own black bleed seamlessly.
const BLACK = { r: 10, g: 10, b: 10, alpha: 1 };

async function makeIcon(size, paddingPct, outName) {
  const inner = Math.round(size * (1 - paddingPct * 2));
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: BLACK })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BLACK },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, outName));
  console.log(`✓ ${outName}  (${size}×${size}, padding ${(paddingPct * 100).toFixed(0)}%)`);
}

console.log(`Source: ${path.relative(ROOT, SRC)}`);
await makeIcon(192, 0.05, 'icon-192.png');
await makeIcon(512, 0.05, 'icon-512.png');
// Maskable safe zone is the inner 80% of the canvas — leaving ≥10% on each
// side keeps the wordmark whole even on aggressive Pixel/OEM crops.
await makeIcon(512, 0.15, 'icon-maskable-512.png');
console.log('\nDone. Update manifest.json to point to these files.');
