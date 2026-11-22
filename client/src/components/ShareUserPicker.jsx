import { useEffect, useState } from 'react';
import { api } from '../api';

// Search RepLab users and invite one to a workout — the same picker as the
// My Workouts Share screen (POST /sharing/invite), packaged so other share
// screens (e.g. the workout summary) can drop it in.
export default function ShareUserPicker({ templateId, workoutName }) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Debounced search; an empty query returns the first users alphabetically
  // so there's a list as soon as the screen opens.
  useEffect(() => {
    const q = search.trim();
    let cancelled = false;
    const handle = setTimeout(() => {
      api(`/sharing/users?q=${encodeURIComponent(q)}`)
        .then((v) => { if (!cancelled) setUsers(Array.isArray(v) ? v : []); })
        .catch(() => { if (!cancelled) setUsers([]); });
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [search]);

  async function sendInvite() {
    if (!selected.trim() || !templateId) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await api('/sharing/invite', { method: 'POST', body: JSON.stringify({ templateId, recipientIdentifier: selected.trim() }) });
      setResult({ success: true, message: `Invited ${data.recipientName}!` });
      setSelected('');
    } catch (err) {
      // A retried request may have already gone through — the server's
      // duplicate guard then says "already invited", which means it did.
      if (err?.status === 400 && /already invited/i.test(err.message || '')) {
        setResult({ success: true, message: 'Invite sent!' });
        setSelected('');
      } else {
        setResult({ success: false, message: err.message || 'Failed to invite' });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="text-[12px] text-white/50 font-light leading-relaxed mb-3">
        Invite someone to do <span className="text-white font-semibold">{workoutName || 'this workout'}</span>.
      </p>
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setResult(null); }}
        placeholder="Search users..."
        aria-label="Search users"
        className="w-full px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none mb-3"
        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px' }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
      />
      {result && (
        <p className={`text-sm mb-3 ${result.success ? 'text-green-400' : 'text-red-400'}`}>{result.message}</p>
      )}
      <div className="max-h-64 overflow-y-auto space-y-1 mb-3">
        {users.map((u) => {
          const id = u.username || u.name;
          const on = selected === id;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => { setSelected(id); setResult(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${on ? 'border' : 'hover:bg-white/5 active:bg-white/10 border border-transparent'}`}
              style={on ? { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)', borderRadius: '2px' } : { borderRadius: '2px' }}
            >
              {u.photo ? (
                <img src={u.photo} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-wf-red to-orange-500 flex items-center justify-center shrink-0">
                  <span className="text-white text-sm font-bold">{(u.name || 'U')[0].toUpperCase()}</span>
                </div>
              )}
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                {u.username && <p className="text-xs text-white/50">@{u.username}</p>}
              </div>
              {on && (
                <svg className="w-5 h-5 shrink-0 ml-auto" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          );
        })}
        {users.length === 0 && <p className="text-center text-white/50 text-sm py-4">No users found</p>}
      </div>
      <button
        type="button"
        onClick={sendInvite}
        disabled={loading || !selected.trim()}
        className="w-full py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)', color: '#000', borderRadius: '2px', letterSpacing: '0.2em', boxShadow: '0 4px 14px rgba(255,255,255,0.1)' }}
      >
        {loading ? 'Sending...' : 'Send Invite'}
      </button>
    </div>
  );
}
