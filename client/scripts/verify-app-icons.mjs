// Quick verifier: prints each generated icon's filename, width, height, bytes.
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.resolve(__dirname, '..');

const targets = [
  ...['Icon-20', 'Icon-29', 'Icon-40', 'Icon-58', 'Icon-60', 'Icon-76',
      'Icon-80', 'Icon-87', 'Icon-120', 'Icon-152', 'Icon-167', 'Icon-180',
      'AppIcon-512@2x'].map((n) => path.join(
    CLIENT_ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', `${n}.png`
  )),
  ...['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi']
    .flatMap((d) => ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']
      .map((f) => path.join(CLIENT_ROOT, 'android', 'app', 'src', 'main', 'res', d, f))),
];

for (const t of targets) {
  try {
    const m = await sharp(t).metadata();
    const s = await fs.stat(t);
    console.log(`${m.width}x${m.height}  ${s.size.toString().padStart(7)} bytes  ${path.relative(CLIENT_ROOT, t)}`);
  } catch (e) {
    console.log(`MISSING  ${path.relative(CLIENT_ROOT, t)}`);
  }
}
