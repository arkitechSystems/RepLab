// Shared helpers for generating workout summary share artifacts:
// a 1080px canvas image and a plain-text summary. Used by both the
// regular WorkoutSession summary and the featured program summary.

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

// opts:
//   workout: { name, exercises: [...] }
//   programName: string
//   entries: Record<entryKey, Array<{weight, reps}>>
//   completedSets: Set<string>
//   elapsed: number (seconds)
//   totalSets, totalVolume: numbers
//   formatTime: (s:number) => string
//   getEntryKey: (exercises, exercise, idx) => string — defaults to exercise.name
export async function generateSummaryImage(opts) {
  const {
    workout,
    programName,
    entries,
    completedSets,
    elapsed,
    totalSets,
    totalVolume,
    formatTime,
    getEntryKey = (_list, ex) => ex.name,
  } = opts;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const W = 1080;
  const padding = 60;
  const contentWidth = W - padding * 2;
  const font = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  // Pre-calculate height
  let y = 0;
  y += padding;
  y += 50; // logo
  y += 20;
  if (programName) y += 36;
  y += 50; // workout name base
  ctx.canvas.width = W;
  ctx.font = `bold 44px ${font}`;
  const nameLines = wrapText(ctx, workout.name, contentWidth);
  if (nameLines.length > 1) y += (nameLines.length - 1) * 52;
  y += 40; // subtitle
  y += 50;
  y += 120; // stats
  y += 50;

  workout.exercises.forEach((ex) => {
    if (ex.isSectionHeader) {
      y += 60;
      return;
    }
    y += 50;
    y += (ex.sets?.length || 0) * 38;
    y += 24;
  });

  y += 30;
  y += 60; // date
  y += 40; // footer
  y += padding;

  canvas.width = W;
  canvas.height = y;

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#0a0a0a');
  grad.addColorStop(0.5, '#0f0f0f');
  grad.addColorStop(1, '#111111');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, canvas.height);

  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.6);
  glow.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, canvas.height / 3);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, canvas.height - 2);

  let curY = padding;

  // Logo
  ctx.font = `900 46px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Brand split: "REP" white, "LAB" red — mirrors the in-app REPLAB wordmark.
  const repW = ctx.measureText('REP').width;
  const labW = ctx.measureText('LAB').width;
  const totalLogoW = repW + labW + 4;
  const logoStartX = W / 2 - totalLogoW / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('REP', logoStartX, curY + 25);
  ctx.fillStyle = '#ef4444';
  ctx.fillText('LAB', logoStartX + repW + 4, curY + 25);
  curY += 50;

  curY += 10;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, curY);
  ctx.lineTo(W - padding, curY);
  ctx.stroke();
  curY += 20;

  if (programName) {
    ctx.font = `500 24px ${font}`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText(programName, W / 2, curY + 14);
    curY += 36;
  }

  // Workout name
  ctx.font = `bold 44px ${font}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  nameLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, curY + 30 + i * 52);
  });
  curY += 30 + nameLines.length * 52 - 20;

  // Subtitle
  ctx.font = `600 22px ${font}`;
  ctx.fillStyle = '#22c55e';
  ctx.textAlign = 'center';
  ctx.fillText('Workout Complete  \u2713', W / 2, curY + 20);
  curY += 50;

  // Stats boxes
  const boxGap = 20;
  const boxW = (contentWidth - boxGap * 2) / 3;
  const boxH = 100;
  const statsData = [
    { label: 'TIME', value: formatTime(elapsed) },
    { label: 'SETS', value: `${completedSets.size}/${totalSets}` },
    { label: 'VOLUME', value: `${totalVolume.toLocaleString()} lbs` },
  ];
  statsData.forEach((stat, i) => {
    const bx = padding + i * (boxW + boxGap);
    const by = curY;
    drawRoundRect(ctx, bx, by, boxW, boxH, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `600 16px ${font}`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText(stat.label, bx + boxW / 2, by + 36);
    ctx.font = `800 28px ${font}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(stat.value, bx + boxW / 2, by + 72);
  });
  curY += boxH + 50;

  // Exercise list
  ctx.textAlign = 'left';
  workout.exercises.forEach((ex, exIdx) => {
    if (ex.isSectionHeader) {
      ctx.fillStyle = '#ef4444';
      drawRoundRect(ctx, padding, curY + 8, 4, 32, 2);
      ctx.fill();
      ctx.font = `700 20px ${font}`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(ex.name.toUpperCase(), padding + 16, curY + 30);
      curY += 60;
      return;
    }
    ctx.font = `bold 28px ${font}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ex.name, padding, curY + 30);
    curY += 50;

    const eKey = getEntryKey(workout.exercises, ex, exIdx);
    const exEntries = entries[eKey] || [];
    (ex.sets || []).forEach((set, idx) => {
      const e = exEntries[idx];
      const actualWeight = Number(e?.weight) || 0;
      const actualReps = Number(e?.reps) || 0;
      const goalReps = set.plannedReps || 0;
      const weightStr = actualWeight === -1 ? 'BW' : `${actualWeight} lbs`;
      const hitGoal = goalReps > 0 ? actualReps >= goalReps : true;

      ctx.font = `600 22px ${font}`;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`${idx + 1}`, padding + 8, curY + 24);

      ctx.font = `500 22px ${font}`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(`${weightStr}  \u00D7  ${actualReps} reps`, padding + 50, curY + 24);

      if (goalReps > 0) {
        const goalText = `${actualReps}/${goalReps}`;
        ctx.textAlign = 'right';
        ctx.font = `700 20px ${font}`;
        ctx.fillStyle = hitGoal ? '#22c55e' : '#ef4444';
        ctx.fillText(goalText + (hitGoal ? '  \u2713' : '  \u2717'), W - padding, curY + 24);
        ctx.textAlign = 'left';
      }
      curY += 38;
    });
    curY += 24;
  });

  curY += 10;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, curY);
  ctx.lineTo(W - padding, curY);
  ctx.stroke();
  curY += 30;

  ctx.font = `500 20px ${font}`;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'center';
  ctx.fillText(
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    W / 2,
    curY + 14,
  );
  curY += 40;

  ctx.font = `600 20px ${font}`;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillText('Logged with REPLAB', W / 2, curY + 14);

  return canvas.toDataURL('image/png');
}

export function composeShareText(opts) {
  const {
    workout,
    programName,
    entries,
    completedSets,
    elapsed,
    totalSets,
    totalVolume,
    formatTime,
    getEntryKey = (_list, ex) => ex.name,
  } = opts;

  const lines = [];
  if (programName) lines.push(programName);
  lines.push(`${workout.name} \u2014 Workout Complete!`);
  lines.push(`Time: ${formatTime(elapsed)} | Sets: ${completedSets.size}/${totalSets} | Volume: ${totalVolume.toLocaleString()} lbs`);
  lines.push('');
  workout.exercises.forEach((ex, exIdx) => {
    if (ex.isSectionHeader) {
      lines.push(`\u2014 ${ex.name} \u2014`);
      if (ex.sectionNotes) lines.push(`  ${ex.sectionNotes}`);
      return;
    }
    const eKey = getEntryKey(workout.exercises, ex, exIdx);
    const exEntries = entries[eKey] || [];
    lines.push(ex.name);
    (ex.sets || []).forEach((set, idx) => {
      const e = exEntries[idx];
      const w = Number(e?.weight) === -1 ? 'BW' : `${Number(e?.weight) || 0} lbs`;
      const goalReps = set.plannedReps || 0;
      const actualReps = Number(e?.reps) || 0;
      const hit = goalReps > 0 && actualReps >= goalReps;
      lines.push(`  Set ${idx + 1}: ${w} \u00D7 ${actualReps} reps${goalReps ? ` (goal: ${goalReps})` : ''}${hit ? ' \u2713' : ''}`);
    });
    lines.push('');
  });
  lines.push('Logged with REPLAB');
  return lines.join('\n');
}
