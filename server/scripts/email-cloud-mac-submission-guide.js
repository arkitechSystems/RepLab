// One-off: build a PDF App Store submission guide and email it via Resend.
// Usage: node --env-file=.env scripts/email-cloud-mac-submission-guide.js
//
// Tailored to the cloud Mac flow for REPLAB Fitness (Capacitor iOS wrapper).
// Project constants pulled from /memory: Team ID BMPD2FUVGY, bundle
// com.replab.fitness, display name "REPLAB Fitness".

import PDFDocument from 'pdfkit';
import { Resend } from 'resend';

const RECIPIENT = 'willmartinmail@gmail.com';
const SUBJECT = 'REPLAB Fitness — App Store Submission Guide (Cloud Mac)';
const FROM = 'REPLAB <noreply@email.replab-fitness.com>';

const RED = '#EF4444';
const NEAR_BLACK = '#1a1816';
const SUBTLE = '#666666';

function buildPdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      info: {
        Title: 'REPLAB iOS Submission Guide',
        Author: 'ArkiTech Systems LLC',
        Subject: 'App Store submission via cloud Mac',
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // --- Cover header --------------------------------------------------
    doc.fillColor(NEAR_BLACK).font('Helvetica-Bold').fontSize(28).text('REPLAB', { continued: true });
    doc.fillColor(RED).text(' FITNESS');
    doc.moveDown(0.2);
    doc.fillColor(NEAR_BLACK).font('Helvetica-Bold').fontSize(16).text('iOS App Store Submission — Cloud Mac Guide');
    doc.moveDown(0.4);
    doc.fillColor(SUBTLE).font('Helvetica').fontSize(10)
      .text(`Generated ${new Date().toISOString().slice(0, 10)} • Capacitor iOS wrapper • Xcode required`);
    doc.moveDown(0.6);
    drawRule(doc);
    doc.moveDown(0.8);

    // --- Project constants box ----------------------------------------
    box(doc, 'PROJECT CONSTANTS', [
      ['Display name', 'REPLAB Fitness'],
      ['Bundle ID', 'com.replab.fitness'],
      ['Team ID', 'BMPD2FUVGY'],
      ['Apple Dev account', 'ArkiTech Systems LLC (Organization)'],
      ['Xcode workspace', 'client/ios/App/App.xcworkspace'],
      ['Repo', 'github.com/arkitechSystems/RepLab (main branch)'],
    ]);

    // --- Sections ------------------------------------------------------
    section(doc, '1. Pre-flight on the cloud Mac');
    bullets(doc, [
      'Confirm Xcode is installed and up to date (Mac App Store → Xcode → UPDATE if available). You need Xcode 15+.',
      'Confirm Node.js 20+ is installed: `node --version`. If missing, install via `brew install node@20`.',
      'Confirm CocoaPods is installed: `pod --version`. If missing: `sudo gem install cocoapods` (may need `arch -x86_64` prefix on Apple Silicon).',
      'In Xcode → Settings → Accounts, sign in with the Apple ID associated with the ArkiTech Systems LLC team (Team ID BMPD2FUVGY).',
      'Open Xcode once to accept any first-launch license prompts.',
    ]);

    section(doc, '2. Get the code onto the Mac');
    code(doc, [
      '# If not yet cloned:',
      'cd ~',
      'git clone https://github.com/arkitechSystems/RepLab.git',
      'cd RepLab',
      '',
      '# If already cloned, pull latest main:',
      'cd ~/RepLab',
      'git checkout main',
      'git pull origin main',
    ]);

    section(doc, '3. Install deps and build the web bundle');
    code(doc, [
      '# Root install (server + tooling):',
      'npm install',
      '',
      '# Client install + build:',
      'cd client',
      'npm install',
      'npm run build',
      '',
      '# Capacitor copies client/dist → ios/App/App/public:',
      'npx cap sync ios',
    ]);
    doc.fillColor(SUBTLE).font('Helvetica-Oblique').fontSize(9)
      .text('If `npx cap sync ios` runs `pod install` and fails on a CocoaPods error, run `cd ios/App && pod repo update && pod install` then retry.');
    doc.moveDown(0.6);

    section(doc, '4. Open Xcode and configure signing');
    code(doc, [
      'cd ~/RepLab/client/ios/App',
      'open App.xcworkspace',
      '# (open the .xcworkspace — NOT App.xcodeproj)',
    ]);
    bullets(doc, [
      'In the left sidebar select the blue "App" project at the top.',
      'In the editor select the "App" target → "Signing & Capabilities" tab.',
      'Check "Automatically manage signing".',
      'Team: select "ArkiTech Systems LLC" (Team ID BMPD2FUVGY).',
      'Bundle Identifier: must read exactly com.replab.fitness.',
      'Open the "General" tab. Bump "Version" if this is a re-submission (e.g. 1.0.0 → 1.0.1) and bump "Build" (always increment, even on re-uploads of the same version).',
      'Confirm Info.plist already has ITSAppUsesNonExemptEncryption = false and CFBundleDisplayName = "REPLAB Fitness" (committed 9578942 + 37ef927). No action needed unless these are missing.',
    ]);

    section(doc, '5. Archive and upload to App Store Connect');
    bullets(doc, [
      'At the top of Xcode change the run-destination dropdown (next to the scheme) to "Any iOS Device (arm64)". You cannot archive against a simulator.',
      'Menu → Product → Archive. Build takes 5–15 minutes on a cloud Mac.',
      'When the archive finishes, the Organizer window opens automatically. If it doesn\'t: Window → Organizer → Archives.',
      'Select the newest archive → click "Distribute App".',
      'Method: "App Store Connect" → Next.',
      'Destination: "Upload" → Next.',
      'App Store distribution options: leave defaults (Upload symbols ON, Manage version + build ON if you want Xcode to handle them) → Next.',
      'Signing: "Automatically manage signing" → Next.',
      'Review summary → "Upload". The upload itself runs 3–10 minutes depending on cloud Mac bandwidth.',
      'On success you\'ll see "App Uploaded". Build appears in App Store Connect after Apple finishes processing it (usually 5–30 minutes; sometimes longer).',
    ]);

    section(doc, '6. App Store Connect — finish the listing and submit');
    bullets(doc, [
      'Open appstoreconnect.apple.com → My Apps → REPLAB Fitness.',
      'Click the version you\'re submitting (left sidebar — should already exist as "1.0 Prepare for Submission" or similar).',
      'Under "Build" click the (+) and select the newly processed build. (If it\'s not there yet, wait — processing isn\'t done.)',
      'Fill required listing fields: Description, Keywords, Support URL, Marketing URL (optional), Promotional Text (optional).',
      'Screenshots: upload the 6.7" iPhone set (1290 × 2796) and the 6.5" set (1242 × 2688). These are required.',
      'App Review Information: provide a demo account (the seeded Apple reviewer account — see server/scripts/seed-apple-reviewer-account.js for credentials), and any notes the reviewer needs to test core flows.',
      'Age rating, content rights, and pricing if not already set.',
      'Top right → "Add for Review" → "Submit to App Review".',
    ]);

    section(doc, 'Pre-submission sanity checklist');
    bullets(doc, [
      'Marketing version + build number bumped from last upload.',
      'Bundle ID = com.replab.fitness (no typos, no suffix).',
      'Encryption disclosure: ITSAppUsesNonExemptEncryption = false (already in Info.plist).',
      'Display name: REPLAB Fitness (already in Info.plist; renders under the home-screen icon).',
      'No `window.confirm()` or `window.alert()` left in user-facing code paths — Apple flags these as "debug build" UI.',
      'Push notifications: do not request permission on app launch — only after a user action that contextualizes the prompt (Apple guideline 4.5.4).',
      'Account deletion path is reachable from inside the app (5.1.1.v).',
      'External-payment / web-purchase links removed if any (3.1.1 / 3.1.3).',
    ]);

    section(doc, 'If the upload fails');
    bullets(doc, [
      '"No accounts with App Store Connect access": sign back into Xcode → Settings → Accounts and confirm the Apple ID has Admin or App Manager role on the ArkiTech Systems LLC team.',
      '"Invalid Bundle. The bundle does not support the minimum OS Version specified in the Info.plist": General tab → set "iOS Deployment Target" to 13.0 or higher.',
      '"App icon set …missing":  Assets.xcassets → AppIcon — confirm the 1024×1024 marketing icon is present and has no transparency / no alpha channel.',
      '"ITMS-90683 — Missing purpose string": Info.plist must have NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSPhotoLibraryAddUsageDescription (all already present per commit 9578942).',
      'CocoaPods errors after `cap sync`: `cd client/ios/App && pod deintegrate && pod install`.',
      'Stuck at "Processing" in App Store Connect for >2 hours: open a developer support ticket; usually it clears on its own.',
    ]);

    section(doc, 'After submission');
    bullets(doc, [
      'Apple review typically takes 24–48 hours for a v1 submission.',
      'You\'ll get email + push notifications from App Store Connect on status changes (In Review → Pending Developer Release → Ready for Sale).',
      'If rejected: the rejection notice is in App Store Connect → Resolution Center. Read the exact guideline number cited; that\'s the only thing Apple cares about. Reply in the Resolution Center with the fix.',
    ]);

    doc.end();
  });
}

function drawRule(doc) {
  const y = doc.y;
  doc.strokeColor('#dddddd').lineWidth(0.5).moveTo(56, y).lineTo(556, y).stroke();
}

function section(doc, title) {
  if (doc.y > 680) doc.addPage();
  doc.moveDown(0.4);
  doc.fillColor(RED).font('Helvetica-Bold').fontSize(9).text(title.split('.')[0] ? title.split('.')[0].toUpperCase() : 'SECTION', { continued: false });
  doc.fillColor(NEAR_BLACK).font('Helvetica-Bold').fontSize(13).text(title);
  doc.moveDown(0.3);
}

function bullets(doc, items) {
  doc.font('Helvetica').fontSize(10).fillColor(NEAR_BLACK);
  for (const item of items) {
    if (doc.y > 720) doc.addPage();
    const startY = doc.y;
    doc.fillColor(RED).text('•', 56, startY, { width: 12, continued: false });
    doc.fillColor(NEAR_BLACK).text(item, 70, startY, { width: 486, align: 'left' });
    doc.moveDown(0.2);
  }
  doc.moveDown(0.3);
}

function code(doc, lines) {
  if (doc.y > 680) doc.addPage();
  const startY = doc.y;
  const height = lines.length * 13 + 16;
  doc.rect(56, startY, 500, height).fillColor('#f5f3f0').fill();
  doc.fillColor(NEAR_BLACK).font('Courier').fontSize(9);
  let y = startY + 8;
  for (const line of lines) {
    doc.text(line, 64, y, { width: 484, lineBreak: false });
    y += 13;
  }
  doc.y = startY + height + 8;
  doc.moveDown(0.2);
}

function box(doc, title, rows) {
  const startY = doc.y;
  const rowH = 16;
  const height = rows.length * rowH + 28;
  doc.rect(56, startY, 500, height).fillColor('#fafafa').fill().strokeColor('#e5e5e5').lineWidth(0.5).stroke();
  doc.fillColor(RED).font('Helvetica-Bold').fontSize(8).text(title, 64, startY + 8, { characterSpacing: 1.5 });
  doc.font('Helvetica').fontSize(10).fillColor(NEAR_BLACK);
  let y = startY + 24;
  for (const [k, v] of rows) {
    doc.fillColor(SUBTLE).text(k, 64, y, { width: 130, continued: false });
    doc.fillColor(NEAR_BLACK).font('Helvetica-Bold').text(v, 196, y, { width: 350, continued: false });
    doc.font('Helvetica');
    y += rowH;
  }
  doc.y = startY + height + 12;
}

// --- Send ----------------------------------------------------------
async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY — aborting.');
    process.exit(1);
  }

  console.log('Building PDF…');
  const pdf = await buildPdf();
  console.log(`PDF built: ${pdf.length} bytes`);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1816;">
      <h1 style="font-size: 24px; margin: 0 0 8px 0;">REPLAB Fitness — App Store Submission Guide</h1>
      <p style="font-size: 14px; color: #666; margin: 0 0 16px 0;">Cloud Mac walkthrough • iOS via Capacitor</p>
      <p style="font-size: 14px; line-height: 1.5;">Attached is the full step-by-step PDF guide for submitting REPLAB Fitness to the App Store from the cloud Mac. It covers pre-flight setup, code checkout, build &amp; Capacitor sync, Xcode signing, archive &amp; upload, and the App Store Connect listing.</p>
      <p style="font-size: 14px; line-height: 1.5;"><strong>Project constants:</strong><br/>
        Bundle ID: <code>com.replab.fitness</code><br/>
        Team ID: <code>BMPD2FUVGY</code><br/>
        Workspace: <code>client/ios/App/App.xcworkspace</code>
      </p>
      <p style="font-size: 12px; color: #999; margin-top: 32px;">Generated by REPLAB tooling.</p>
    </div>
  `;

  console.log(`Sending email to ${RECIPIENT}…`);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: RECIPIENT,
    subject: SUBJECT,
    html,
    attachments: [
      {
        filename: 'REPLAB-AppStore-Submission-Guide.pdf',
        content: pdf.toString('base64'),
      },
    ],
  });

  if (error) {
    console.error('Resend error:', error);
    process.exit(1);
  }
  console.log('Sent. Resend message id:', data?.id);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
