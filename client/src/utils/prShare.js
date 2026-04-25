// Render a 1080×1080 PR card to a PNG and hand it to the OS share sheet
// (Web Share API). On platforms that don't support sharing files, fall back
// to a plain text+title share, then to a forced PNG download.
//
// Tries hard to feel native: uses navigator.share with a File when possible,
// because that's what surfaces "Save to Photos" on iOS, "Save image" on
// Android, and the various social-app share targets.

function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(',');
  // Defensive: malformed data URL falls back to PNG instead of crashing on
  // a null match. canvas.toDataURL() should always produce a valid header,
  // but this protects against any future caller passing untrusted input.
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(parts[1] || '');
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

// Cache the logo across multiple shares in the same session.
let _logoPromise = null;
function loadLogo() {
  if (_logoPromise) return _logoPromise;
  _logoPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/RepLabLogo2.jpg';
  });
  return _logoPromise;
}

// Build a square PR card. Black bg, red→orange gradient blob, big numbers,
// RepLab logo in the corner.
async function drawPRCard({ muscle, exercise, weight, reps, achievedAt }) {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  // Base: deep gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0a0a0a');
  bg.addColorStop(1, '#000');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Red glow blob top-right
  const glow1 = ctx.createRadialGradient(W * 0.85, H * 0.1, 50, W * 0.85, H * 0.1, 700);
  glow1.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
  glow1.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  // Orange glow blob bottom-left
  const glow2 = ctx.createRadialGradient(W * 0.05, H * 0.95, 40, W * 0.05, H * 0.95, 600);
  glow2.addColorStop(0, 'rgba(249, 115, 22, 0.35)');
  glow2.addColorStop(1, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Subtle hatch pattern
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  for (let i = -H; i < W; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.restore();

  // Top eyebrow — tripled from 26px to 78px so it reads as the headline,
  // not a tagline.
  ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
  ctx.font = `700 78px ${font}`;
  ctx.textBaseline = 'top';
  ctx.fillText('PERSONAL RECORD', 80, 88);

  // RepLab logo top-right (replaces the old REPLAB wordmark). Falls back to
  // text if the logo failed to load — keeps the corner from looking empty.
  const logo = await loadLogo();
  const logoSize = 140;
  if (logo) {
    ctx.drawImage(logo, W - 80 - logoSize, 60, logoSize, logoSize);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `900 24px ${font}`;
    ctx.textAlign = 'right';
    ctx.fillText('REPLAB', W - 80, 88);
    ctx.textAlign = 'left';
  }

  // Muscle group label
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `600 28px ${font}`;
  ctx.fillText(String(muscle || '').toUpperCase(), 80, 200);

  // Exercise name (wrap if too long)
  ctx.fillStyle = '#fff';
  ctx.font = `900 88px ${font}`;
  const exerciseName = String(exercise || '').toUpperCase();
  // Quick wrap: if it fits, single line; if not, two lines on word boundary
  const maxNameWidth = W - 160;
  if (ctx.measureText(exerciseName).width <= maxNameWidth) {
    ctx.fillText(exerciseName, 80, 250);
  } else {
    const words = exerciseName.split(' ');
    let line1 = '', line2 = '';
    for (const w of words) {
      const tryLine = line1 ? line1 + ' ' + w : w;
      if (ctx.measureText(tryLine).width <= maxNameWidth) line1 = tryLine;
      else line2 += (line2 ? ' ' : '') + w;
    }
    ctx.fillText(line1, 80, 250);
    ctx.fillText(line2, 80, 350);
  }

  // Big numbers — weight in red, reps in white, all bottom half
  const numY = 580;
  ctx.font = `900 220px ${font}`;
  ctx.textBaseline = 'top';

  const weightText = String(weight);
  const xText = '×';
  const repsText = String(reps);
  const lbsText = ' LBS';

  // Measure for layout
  const wW = ctx.measureText(weightText).width;
  ctx.font = `900 80px ${font}`;
  const lbsW = ctx.measureText(lbsText).width;
  ctx.font = `900 220px ${font}`;
  const totalLeft = wW + lbsW;

  // Weight number (red)
  ctx.fillStyle = '#ef4444';
  ctx.font = `900 220px ${font}`;
  ctx.fillText(weightText, 80, numY);

  // " LBS" suffix (smaller, white)
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `900 72px ${font}`;
  ctx.fillText(lbsText, 80 + wW, numY + 130);

  // × reps (right-aligned)
  ctx.fillStyle = '#fff';
  ctx.font = `900 220px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText(repsText, W - 80, numY);
  ctx.font = `900 72px ${font}`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(' REPS', W - 80, numY + 230);
  ctx.textAlign = 'left';

  // Bottom: thin red line + date
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(80, H - 160);
  ctx.lineTo(220, H - 160);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `500 30px ${font}`;
  ctx.fillText(formatDate(achievedAt), 80, H - 130);

  return canvas.toDataURL('image/png');
}

/**
 * Share a single PR via the OS share sheet (or fall back to download).
 * Returns true if the share was attempted, false if the user closed it
 * or the platform doesn't support sharing.
 */
export async function sharePR(pr) {
  const dataUrl = await drawPRCard(pr);
  const blob = dataURLtoBlob(dataUrl);
  const filename = `RepLab-PR-${pr.exercise}-${pr.weight}lb.png`
    .replace(/[^a-zA-Z0-9.\-]/g, '_');
  const file = new File([blob], filename, { type: 'image/png' });

  const text = `${pr.exercise} — ${pr.weight} lbs × ${pr.reps} reps. New PR. 💪 #RepLab`;

  // Best path: share file via Web Share API
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'New PR', text });
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
      // Fall through to other strategies
    }
  }

  // Text-only share (older Web Share API)
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'New PR', text });
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
    }
  }

  // Last resort: trigger a download so the user has the image
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}
