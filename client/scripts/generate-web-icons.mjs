// Generates the PWA / Apple touch icons from client/public/replab-logo.png.
// Run from client/:  node scripts/generate-web-icons.mjs
//
// Outputs (all overwritten in place):
//   public/apple-touch-icon.png   180x180   iOS Add to Home Screen
//   public/icon-192.png           192x192   PWA standard
//   public/icon-512.png           512x512   PWA standard
//   public/icon-maskable-512.png  512x512   PWA maskable (logo padded to ~80%
//                                            safe zone so adaptive masks
//                                            don't clip the RL letters)
//   public/favicon-32.png         32x32     browser tab favicon

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, '..', 'public');
const SOURCE = path.join(PUBLIC, 'replab-logo.png');

const meta = await sharp(SOURCE).metadata();
console.log(`Source: ${SOURCE} (${meta.width}x${meta.height} ${meta.format})`);

// Straight square resize on solid black background — works for all the
// non-maskable variants (favicon, apple-touch-icon, icon-192, icon-512).
async function squareResize(size, outName) {
  const out = path.join(PUBLIC, outName);
  await sharp(SOURCE)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  wrote ${outName}  ${size}x${size}`);
}

// Maskable variant: pad the logo so it sits inside the inner 80% of the
// canvas. Adaptive icon masks (Android, some Chromium home screens) crop
// outside that safe zone; without the pad the RL letters get clipped.
async function maskableResize(size, outName) {
  const out = path.join(PUBLIC, outName);
  const safe = Math.round(size * 0.80);
  const buf = await sharp(SOURCE)
    .resize(safe, safe, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([{ input: buf, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  wrote ${outName}  ${size}x${size} (safe zone ${safe}x${safe})`);
}

await squareResize(32,  'favicon-32.png');
await squareResize(180, 'apple-touch-icon.png');
await squareResize(192, 'icon-192.png');
await squareResize(512, 'icon-512.png');
await maskableResize(512, 'icon-maskable-512.png');

console.log('\nDone.');
