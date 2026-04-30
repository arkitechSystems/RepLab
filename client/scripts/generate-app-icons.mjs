// Generates iOS and Android app icons from the 1024x1024 master PNG.
// Run from the client/ directory:  node scripts/generate-app-icons.mjs

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

const IOS_APPICON_DIR = path.join(
  CLIENT_ROOT,
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset'
);
const ANDROID_RES_DIR = path.join(
  CLIENT_ROOT,
  'android',
  'app',
  'src',
  'main',
  'res'
);

const SOURCE_PNG = path.join(IOS_APPICON_DIR, 'AppIcon-512@2x.png');

// Unique iOS pixel sizes to generate as separate files.
// Multiple Contents.json entries can reference the same filename.
const IOS_PIXEL_SIZES = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180];

// iOS Contents.json image entries (Xcode 14+ schema).
// Each entry maps to a generated file via `filename`.
const IOS_CONTENTS_IMAGES = [
  // iPhone Notification 20pt
  { size: '20x20', idiom: 'iphone', filename: 'Icon-40.png', scale: '2x' },
  { size: '20x20', idiom: 'iphone', filename: 'Icon-60.png', scale: '3x' },
  // iPhone Settings 29pt
  { size: '29x29', idiom: 'iphone', filename: 'Icon-58.png', scale: '2x' },
  { size: '29x29', idiom: 'iphone', filename: 'Icon-87.png', scale: '3x' },
  // iPhone Spotlight 40pt
  { size: '40x40', idiom: 'iphone', filename: 'Icon-80.png', scale: '2x' },
  { size: '40x40', idiom: 'iphone', filename: 'Icon-120.png', scale: '3x' },
  // iPhone App 60pt
  { size: '60x60', idiom: 'iphone', filename: 'Icon-120.png', scale: '2x' },
  { size: '60x60', idiom: 'iphone', filename: 'Icon-180.png', scale: '3x' },
  // iPad Notification 20pt
  { size: '20x20', idiom: 'ipad', filename: 'Icon-20.png', scale: '1x' },
  { size: '20x20', idiom: 'ipad', filename: 'Icon-40.png', scale: '2x' },
  // iPad Settings 29pt
  { size: '29x29', idiom: 'ipad', filename: 'Icon-29.png', scale: '1x' },
  { size: '29x29', idiom: 'ipad', filename: 'Icon-58.png', scale: '2x' },
  // iPad Spotlight 40pt
  { size: '40x40', idiom: 'ipad', filename: 'Icon-40.png', scale: '1x' },
  { size: '40x40', idiom: 'ipad', filename: 'Icon-80.png', scale: '2x' },
  // iPad App 76pt
  { size: '76x76', idiom: 'ipad', filename: 'Icon-76.png', scale: '1x' },
  { size: '76x76', idiom: 'ipad', filename: 'Icon-152.png', scale: '2x' },
  // iPad Pro App 83.5pt
  { size: '83.5x83.5', idiom: 'ipad', filename: 'Icon-167.png', scale: '2x' },
  // App Store marketing 1024x1024 — keep existing source file
  {
    size: '1024x1024',
    idiom: 'ios-marketing',
    filename: 'AppIcon-512@2x.png',
    scale: '1x',
  },
];

// Android adaptive icon sizes.
// Density: legacy ic_launcher.png + ic_launcher_round.png, plus
// ic_launcher_foreground.png at 1.5x size for the adaptive layer.
const ANDROID_DENSITIES = [
  { dir: 'mipmap-mdpi', legacy: 48, foreground: 108 },
  { dir: 'mipmap-hdpi', legacy: 72, foreground: 162 },
  { dir: 'mipmap-xhdpi', legacy: 96, foreground: 216 },
  { dir: 'mipmap-xxhdpi', legacy: 144, foreground: 324 },
  { dir: 'mipmap-xxxhdpi', legacy: 192, foreground: 432 },
];

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function resampleTo(srcBuffer, pixels, outPath) {
  await sharp(srcBuffer)
    .resize(pixels, pixels, { fit: 'cover', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  const meta = await sharp(outPath).metadata();
  return { outPath, width: meta.width, height: meta.height };
}

async function main() {
  if (!existsSync(SOURCE_PNG)) {
    throw new Error(`Source PNG not found: ${SOURCE_PNG}`);
  }

  const sourceMeta = await sharp(SOURCE_PNG).metadata();
  console.log(
    `Source: ${SOURCE_PNG}\n  ${sourceMeta.width}x${sourceMeta.height} (${sourceMeta.format})`
  );
  if (sourceMeta.width !== 1024 || sourceMeta.height !== 1024) {
    throw new Error(
      `Expected 1024x1024 source, got ${sourceMeta.width}x${sourceMeta.height}`
    );
  }

  const srcBuffer = await fs.readFile(SOURCE_PNG);
  const generated = [];

  // ---- iOS icons ----
  await ensureDir(IOS_APPICON_DIR);
  for (const px of IOS_PIXEL_SIZES) {
    const out = path.join(IOS_APPICON_DIR, `Icon-${px}.png`);
    const r = await resampleTo(srcBuffer, px, out);
    generated.push(r);
    console.log(`  iOS  ${px}x${px} -> ${path.basename(out)}`);
  }

  // ---- iOS Contents.json ----
  const contents = {
    images: IOS_CONTENTS_IMAGES,
    info: { author: 'xcode', version: 1 },
  };
  const contentsPath = path.join(IOS_APPICON_DIR, 'Contents.json');
  await fs.writeFile(contentsPath, JSON.stringify(contents, null, 2) + '\n');
  console.log(`  iOS  Contents.json written (${IOS_CONTENTS_IMAGES.length} entries)`);

  // ---- Android icons ----
  for (const d of ANDROID_DENSITIES) {
    const dir = path.join(ANDROID_RES_DIR, d.dir);
    await ensureDir(dir);

    const launcher = path.join(dir, 'ic_launcher.png');
    const launcherRound = path.join(dir, 'ic_launcher_round.png');
    const launcherFg = path.join(dir, 'ic_launcher_foreground.png');

    const a = await resampleTo(srcBuffer, d.legacy, launcher);
    const b = await resampleTo(srcBuffer, d.legacy, launcherRound);
    const c = await resampleTo(srcBuffer, d.foreground, launcherFg);
    generated.push(a, b, c);
    console.log(
      `  AND  ${d.dir}: legacy ${d.legacy}, round ${d.legacy}, fg ${d.foreground}`
    );
  }

  console.log(`\nDone. ${generated.length} files generated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
