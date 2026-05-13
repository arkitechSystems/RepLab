// Pads client/public/replab-logo.png to a 1024x1024 square on a black
// background and writes it as the AppIcon master. After running this,
// run `node scripts/generate-app-icons.mjs` to resample all platform sizes.
//
// Run from client/:  node scripts/prep-icon-source.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.resolve(__dirname, '..');

const SOURCE = path.join(CLIENT_ROOT, 'public', 'replab-logo.png');
const DEST = path.join(
  CLIENT_ROOT,
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset',
  'AppIcon-512@2x.png'
);

const meta = await sharp(SOURCE).metadata();
console.log(`Source: ${SOURCE}\n  ${meta.width}x${meta.height} (${meta.format})`);

await sharp(SOURCE)
  .resize(1024, 1024, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 1 },
  })
  .flatten({ background: { r: 0, g: 0, b: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(DEST);

const out = await sharp(DEST).metadata();
console.log(`Wrote: ${DEST}\n  ${out.width}x${out.height} (${out.format}, alpha: ${out.hasAlpha})`);
