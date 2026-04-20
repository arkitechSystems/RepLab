// Program PDF export — opens a styled print window tuned for "Save as PDF".
// Nike-inspired layout: cream/white pages, heavy black display type,
// subtle RepLab logo watermark fills each page at low opacity.

const WATERMARK_SRC = '/RepLaplogo3NoBG.jpg';

function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setsSummary(ex) {
  if (!ex.sets || ex.sets.length === 0) return '';
  const reps = ex.sets.map(s => s.plannedReps).filter(r => r > 0);
  if (reps.length === 0) return `${ex.sets.length} sets`;
  const allSame = reps.every(r => r === reps[0]);
  if (allSame) return `${ex.sets.length} × ${reps[0]}`;
  return `${ex.sets.length} sets · ${reps.join('/')} reps`;
}

function renderExercise(ex, idx) {
  if (ex.isSectionHeader) {
    return `
      <div class="ex section-header">
        <div class="ex-num">${String(idx + 1).padStart(2, '0')}</div>
        <div class="ex-body">
          <div class="ex-name">${escapeHTML(ex.name)}</div>
          ${ex.sets?.length ? `<div class="ex-meta">${escapeHTML(setsSummary(ex))} · WARM-UP</div>` : ''}
          ${ex.sectionNotes ? `<div class="ex-notes">${escapeHTML(ex.sectionNotes)}</div>` : ''}
          ${ex.description ? `<div class="ex-desc">${escapeHTML(ex.description).replace(/\n/g, '<br/>')}</div>` : ''}
        </div>
      </div>`;
  }
  const typeLabel = ex.setType && ex.setType !== 'straight'
    ? ` · ${ex.setType.replace(/_/g, ' ').toUpperCase()}`
    : '';
  return `
    <div class="ex">
      <div class="ex-num">${String(idx + 1).padStart(2, '0')}</div>
      <div class="ex-body">
        <div class="ex-name">${escapeHTML(ex.name)}</div>
        <div class="ex-meta">${escapeHTML(setsSummary(ex))}${typeLabel}</div>
        ${ex.description ? `<div class="ex-desc">${escapeHTML(ex.description).replace(/\n/g, '<br/>')}</div>` : ''}
      </div>
    </div>`;
}

function renderWorkoutPage(workout, dayIdx) {
  const hasExercises = workout.exercises && workout.exercises.length > 0;
  return `
    <section class="page">
      <div class="watermark"></div>
      <div class="page-inner">
        <header class="workout-head">
          <div class="day-label">Day ${dayIdx + 1}</div>
          <h1 class="workout-title">${escapeHTML(workout.name).toUpperCase()}</h1>
          <div class="workout-sub">${escapeHTML(workout.subtitle || '')}</div>
          ${workout.description ? `<p class="workout-desc">${escapeHTML(workout.description)}</p>` : ''}
          <div class="hrule"></div>
        </header>
        ${hasExercises
          ? `<div class="ex-list">${workout.exercises.map((ex, i) => renderExercise(ex, i)).join('')}</div>`
          : `<div class="coming-soon">This workout is being built. Check back soon.</div>`}
        <footer class="page-foot">
          <span>Will's Hypertrophy Program</span>
          <span>Day ${dayIdx + 1} of ${workout.__totalDays || 6}</span>
        </footer>
      </div>
    </section>`;
}

function renderCoverPage(program, dateStr) {
  return `
    <section class="page cover">
      <div class="cover-spotlight"></div>
      <div class="cover-warm-glow"></div>
      <div class="watermark"></div>
      <div class="page-inner cover-inner">
        <div class="cover-top">
          <div class="brand">REPLAB</div>
          <img class="cover-logo" src="${WATERMARK_SRC}" alt="RepLab" />
        </div>

        <div class="cover-hero">
          <div class="cover-eyebrow">Featured Program</div>
          <h1 class="cover-title">WILL'S<br/>HYPERTROPHY</h1>
          <div class="cover-photo-wrap">
            <div class="cover-floor-shadow"></div>
            <img class="cover-photo" src="/RepLabPhotoShoot.png" alt="Will training" />
          </div>
          <p class="cover-tag">12 weeks. 6 days. Built for growth.</p>
        </div>

        <div class="cover-bot">
          <div class="cover-stats">
            <div class="stat"><div class="stat-num">${program.totalWeeks}</div><div class="stat-label">Weeks</div></div>
            <div class="stat"><div class="stat-num">${program.daysPerWeek.length}</div><div class="stat-label">Days / Wk</div></div>
            <div class="stat"><div class="stat-num">${program.totalWeeks * program.daysPerWeek.length}</div><div class="stat-label">Sessions</div></div>
          </div>
          <p class="cover-desc">${escapeHTML(program.description)}</p>
          <div class="cover-date">${dateStr}</div>
        </div>
      </div>
    </section>`;
}

export function exportProgramPDF({ program, workouts, weeklySchedule }) {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const totalDays = weeklySchedule.length;

  const workoutPages = weeklySchedule
    .map((key, i) => renderWorkoutPage({ ...workouts[key], __totalDays: totalDays }, i))
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Will's Hypertrophy Program</title>
<style>
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #f5f3ee;
    color: #0a0a0a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    position: relative;
    width: 8.5in;
    height: 11in;
    overflow: hidden;
    page-break-after: always;
    background: #f5f3ee;
  }
  .page:last-child { page-break-after: auto; }

  .watermark {
    position: absolute;
    top: 50%; left: 50%;
    width: 7.5in; height: 7.5in;
    transform: translate(-50%, -50%);
    background-image: url("${WATERMARK_SRC}");
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
    opacity: 0.07;
    mix-blend-mode: multiply;
    pointer-events: none;
    z-index: 0;
  }

  .page-inner {
    position: relative;
    z-index: 1;
    padding: 0.75in 0.85in;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* ===== COVER ===== */
  .cover {
    color: #f5f3ee;
    background: linear-gradient(180deg, #1a1a1a 0%, #252525 30%, #2a2a2a 50%, #1a1a1a 80%, #0d0d0d 100%);
  }
  .cover .watermark { opacity: 0.05; filter: invert(1); }
  .cover-spotlight {
    position: absolute; top: 50%; left: 50%;
    width: 6in; height: 6in;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 40%, transparent 70%);
    filter: blur(25px);
    pointer-events: none; z-index: 0;
  }
  .cover-warm-glow {
    position: absolute; top: 30%; left: 18%;
    width: 3.5in; height: 3.5in;
    background: radial-gradient(circle, rgba(239,68,68,0.07) 0%, transparent 60%);
    filter: blur(50px);
    pointer-events: none; z-index: 0;
  }
  .cover-inner { justify-content: space-between; padding: 0.7in 0.8in; }
  .cover-top { display: flex; align-items: flex-start; justify-content: space-between; }
  .brand {
    font-size: 11px; font-weight: 900; letter-spacing: 0.35em;
    color: rgba(245,243,238,0.55);
  }
  .cover-logo {
    width: 1.3in; height: auto;
    display: block;
    filter: drop-shadow(0 4px 20px rgba(0,0,0,0.4));
  }

  .cover-hero {
    display: flex; flex-direction: column; align-items: center;
    text-align: center;
    padding: 0.2in 0;
  }
  .cover-eyebrow {
    font-size: 11px; font-weight: 500; letter-spacing: 0.3em;
    text-transform: uppercase; color: rgba(245,243,238,0.45);
    margin-bottom: 14px;
  }
  .cover-title {
    font-size: 56px; font-weight: 900; line-height: 1;
    letter-spacing: -0.03em;
    color: #f5f3ee;
    text-shadow: 0 2px 20px rgba(0,0,0,0.5);
    margin-bottom: 0.35in;
  }
  .cover-photo-wrap {
    position: relative;
    margin-bottom: 0.35in;
  }
  .cover-floor-shadow {
    position: absolute;
    bottom: -14px; left: 50%;
    transform: translateX(-50%);
    width: 70%; height: 24px;
    background: radial-gradient(ellipse, rgba(0,0,0,0.7) 0%, transparent 70%);
    filter: blur(10px);
  }
  .cover-photo {
    position: relative;
    width: 3.2in; height: auto;
    object-fit: contain;
    filter: drop-shadow(0 14px 40px rgba(0,0,0,0.6));
  }
  .cover-tag {
    font-size: 13px; font-weight: 300; letter-spacing: 0.02em;
    color: rgba(245,243,238,0.55);
  }

  .cover-bot { margin-top: auto; }
  .cover-stats {
    display: flex; gap: 32px; justify-content: center;
    padding: 20px 0;
    border-top: 1px solid rgba(245,243,238,0.15);
    border-bottom: 1px solid rgba(245,243,238,0.15);
    margin-bottom: 18px;
  }
  .stat { text-align: center; }
  .stat-num {
    font-size: 34px; font-weight: 900; letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums; color: #f5f3ee;
  }
  .stat-label {
    font-size: 9px; font-weight: 500; letter-spacing: 0.25em;
    text-transform: uppercase; color: rgba(245,243,238,0.4);
    margin-top: 4px;
  }
  .cover-desc {
    font-size: 11px; line-height: 1.55; font-weight: 300;
    color: rgba(245,243,238,0.55); text-align: center;
    max-width: 5in; margin: 0 auto;
  }
  .cover-date {
    margin-top: 16px;
    font-size: 9px; letter-spacing: 0.3em; text-transform: uppercase;
    color: rgba(245,243,238,0.35); text-align: center;
  }

  /* ===== WORKOUT PAGES ===== */
  .workout-head { margin-bottom: 28px; }
  .day-label {
    font-size: 11px; font-weight: 500; letter-spacing: 0.3em;
    text-transform: uppercase; color: rgba(10,10,10,0.45);
    margin-bottom: 10px;
  }
  .workout-title {
    font-size: 62px; font-weight: 900; line-height: 0.9;
    letter-spacing: -0.03em; color: #0a0a0a;
    margin-bottom: 8px;
  }
  .workout-sub {
    font-size: 13px; font-weight: 500; letter-spacing: 0.2em;
    text-transform: uppercase; color: rgba(10,10,10,0.55);
    margin-bottom: 14px;
  }
  .workout-desc {
    font-size: 11.5px; line-height: 1.55; font-weight: 400;
    color: rgba(10,10,10,0.7); max-width: 6in;
  }
  .hrule { height: 2px; background: #0a0a0a; margin-top: 20px; width: 48px; }

  .ex-list { flex: 1; display: flex; flex-direction: column; gap: 14px; }
  .ex {
    display: flex; gap: 16px; align-items: flex-start;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(10,10,10,0.08);
  }
  .ex:last-child { border-bottom: none; }
  .ex.section-header { background: rgba(10,10,10,0.03); padding: 12px 14px; border-radius: 1px; border-bottom: none; }
  .ex-num {
    font-size: 11px; font-weight: 900; letter-spacing: 0.05em;
    color: rgba(10,10,10,0.35);
    min-width: 22px; padding-top: 3px;
    font-variant-numeric: tabular-nums;
  }
  .ex-body { flex: 1; }
  .ex-name {
    font-size: 14px; font-weight: 700; letter-spacing: -0.005em;
    color: #0a0a0a; line-height: 1.25;
  }
  .ex-meta {
    font-size: 9.5px; font-weight: 600; letter-spacing: 0.18em;
    text-transform: uppercase; color: rgba(10,10,10,0.45);
    margin-top: 4px;
  }
  .ex-notes {
    font-size: 10.5px; line-height: 1.5; font-style: italic;
    color: rgba(10,10,10,0.55); margin-top: 8px;
    padding-left: 10px; border-left: 2px solid rgba(10,10,10,0.15);
  }
  .ex-desc {
    font-size: 10.5px; line-height: 1.5; font-weight: 400;
    color: rgba(10,10,10,0.65); margin-top: 6px;
  }

  .coming-soon {
    flex: 1; display: flex; align-items: center; justify-content: center;
    font-size: 13px; letter-spacing: 0.15em; text-transform: uppercase;
    color: rgba(10,10,10,0.3); font-weight: 500;
  }

  .page-foot {
    display: flex; justify-content: space-between;
    padding-top: 18px; margin-top: 14px;
    border-top: 1px solid rgba(10,10,10,0.1);
    font-size: 9px; font-weight: 500; letter-spacing: 0.2em;
    text-transform: uppercase; color: rgba(10,10,10,0.4);
  }

  @media screen {
    body { padding: 20px; background: #2a2a2a; }
    .page { margin: 0 auto 20px; box-shadow: 0 8px 40px rgba(0,0,0,0.4); }
    .print-bar {
      position: fixed; top: 16px; right: 16px; z-index: 999;
      background: #0a0a0a; color: #fff; padding: 10px 18px;
      border-radius: 100px; font-size: 11px; letter-spacing: 0.2em;
      text-transform: uppercase; font-weight: 700;
      cursor: pointer; border: none;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
  }
  @media print { .print-bar { display: none; } }
</style>
</head>
<body>
  <button class="print-bar" onclick="window.print()">Save as PDF</button>
  ${renderCoverPage(program, dateStr)}
  ${workoutPages}
  <script>
    window.addEventListener('load', () => {
      const img = new Image();
      img.src = "${WATERMARK_SRC}";
      img.onload = () => setTimeout(() => window.print(), 250);
      img.onerror = () => setTimeout(() => window.print(), 250);
    });
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to export the PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
