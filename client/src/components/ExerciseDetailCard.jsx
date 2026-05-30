import ExerciseAnatomy from './ExerciseAnatomy.jsx'; // keep your existing anatomy SVG component

const RED = '#ef4444';
const GREEN = '#3ea868';
const CARD = 'linear-gradient(180deg, #1a1816 0%, #100f0d 100%)';
const BORDER = '1px solid rgba(255,255,255,0.06)';
const MONO = "'JetBrains Mono', ui-monospace, monospace";

function Section({ title, action, children }) {
  return (
    <div style={{ margin: '0 16px 12px', borderRadius: 18, padding: '16px 16px 18px', background: CARD, border: BORDER, boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function ExerciseDetailCard({ exercise }) {
  return (
    <>
      {/* ── Muscles Worked ── */}
      {exercise.musclesWorked?.length > 0 && (
        <Section title="Muscles Worked">
          <div style={{ display: 'flex', gap: 14 }}>
            {/* anatomy diagram from your existing component (figure prop) */}
            {exercise.figure && (
              <div style={{ flex: '0 0 96px', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}>
                <ExerciseAnatomy figure={exercise.figure} />
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
              {exercise.musclesWorked.map((m) => (
                <div key={m.name}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{m.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{m.role} · {m.percentage}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${m.percentage}%`, height: '100%', borderRadius: 100, background: m.color, boxShadow: `0 0 8px ${m.color}66` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ── How To Perform ── */}
      {exercise.instructions?.length > 0 && (
        <Section title="How To Perform">
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {exercise.instructions.map((step, i) => (
              <li key={i} style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontFamily: MONO, flexShrink: 0, width: 24, height: 24, borderRadius: 8, background: 'rgba(239,68,68,0.14)', color: RED, border: '1px solid rgba(239,68,68,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, marginTop: 1 }}>{i + 1}</span>
                <p style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{step}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* ── Form Tips ── */}
      {exercise.formTips?.length > 0 && (
        <Section title="Form Tips">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {exercise.formTips.map((tip, i) => (
              <li key={i} style={{ display: 'flex', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12" /></svg>
                <p style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{tip}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Common Mistakes section is intentionally hidden for now per design
          feedback — the data is still authored in each exercise data file
          (exercise.commonMistakes) so the section can be re-enabled without
          a data migration when the team is ready to ship it. */}
    </>
  );
}
