import { createPortal } from 'react-dom';
import ExternalShareButtons from './ExternalShareButtons';
import { sharePR } from '../utils/prShare';
import { APP_SHARE_FOOTER } from '../utils/shareText';

// Share screen for a PR. Same look as the other share screens; a PR has
// nothing to send inside RepLab, so it's the external options only. Share
// sends the PR picture (sharePR); Messenger/Instagram send the text.
export default function SharePRModal({ pr, onClose }) {
  if (!pr || typeof document === 'undefined') return null;
  const weightText = Number(pr.weight) > 0 ? `${pr.weight} lbs` : 'BW';
  const text = `New PR: ${pr.exercise} — ${weightText} × ${pr.reps} reps 💪\n\n${APP_SHARE_FOOTER}`;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="share-pr-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative flex flex-col mt-auto mb-auto mx-4 overflow-hidden animate-drop-down"
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          borderRadius: '2px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[3px] shrink-0" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
        <div className="relative pt-5 pb-4 px-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase font-light mb-2" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.8)' }}>Share</p>
              <h3 id="share-pr-title" className="text-[22px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>SHARE PR</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 flex items-center justify-center active:scale-90 transition-all shrink-0"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="relative px-6 pb-6">
          <p className="text-[12px] text-white/50 font-light leading-relaxed">
            <span className="text-white font-semibold">{pr.exercise}</span> — {weightText} × {pr.reps} reps
          </p>
          <ExternalShareButtons text={text} onShare={() => sharePR(pr)} />
        </div>
      </div>
    </div>,
    document.body
  );
}
