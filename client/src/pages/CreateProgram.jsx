import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { track } from '../utils/analytics';
import { useUnsavedGuard } from '../components/UnsavedGuard';

export default function CreateProgram() {
  const navigate = useNavigate();
  const [programName, setProgramName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isDirty = programName.trim() !== '' || description.trim() !== '';
  const { guardedNavigate, UnsavedModal } = useUnsavedGuard({ isDirty });

  async function handleSave() {
    setError('');

    if (!programName.trim()) {
      setError('Program name is required');
      return;
    }

    setSaving(true);
    try {
      const program = await api('/programs', {
        method: 'POST',
        body: JSON.stringify({ name: programName.trim(), description: description.trim() }),
      });
      track('program_created', {
        programId: program?.id,
        source: 'create_program_page',
        hasDescription: description.trim().length > 0,
      });
      navigate('/app');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full glass-input rounded-[2px] px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all';
  const labelClass = 'text-[10px] uppercase font-bold mb-1.5 block';
  const labelStyle = { color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em' };

  return (
    <div className="px-4 pt-6 pb-32 min-h-screen relative">
      {UnsavedModal}
      <button
        onClick={() => guardedNavigate(() => navigate(-1))}
        className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors mb-5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      {/* Nike-style panel: black gradient, red accent stripe, ambient
          spotlight, eyebrow + heavy display title. */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          borderRadius: '2px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
        <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        <div className="relative p-6">
          <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
            Programs
          </p>
          <h1 className="text-[28px] font-black text-white tracking-tight mb-2" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
            NEW PROGRAM
          </h1>
          <p className="text-sm text-wf-gray-400 mb-5 leading-relaxed">
            Create your program, then add workouts to it.
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 text-red-300 text-sm" style={{ background: 'rgba(127,29,29,0.30)', border: '1px solid rgba(153,27,27,0.6)', borderRadius: '2px' }}>
              {error}
            </div>
          )}

          <div className="pt-3 border-t border-white/5 space-y-4">
            <div>
              <label className={labelClass} style={labelStyle}>Program Name</label>
              <input
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="e.g. Push Pull Legs"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>
                Description{' '}
                <span className="text-wf-gray-600 normal-case font-normal" style={{ letterSpacing: '0' }}>(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 3-day split focused on hypertrophy"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky save button — red gradient default, flips to btn-liquid +
          spinner while creating. Matches the Sign In / Sign Up CTA. */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent safe-bottom z-40">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full active:scale-[0.98] text-white font-bold uppercase py-4 text-sm transition-transform ${saving ? 'btn-liquid' : ''}`}
            style={saving ? {
              letterSpacing: '0.2em',
              borderRadius: '2px',
            } : {
              letterSpacing: '0.2em',
              borderRadius: '2px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
              boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {saving ? (
              <span className="inline-flex items-center justify-center h-5">
                <span className="replab-spinner inline-block" style={{ width: 20, height: 20 }} />
              </span>
            ) : (
              'Create Program'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
