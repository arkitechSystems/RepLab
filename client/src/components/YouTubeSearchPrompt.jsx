import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import useFocusTrap from '../hooks/useFocusTrap.js';

// Confirmation shown before opening a YouTube search for an exercise that has
// no demo video, since the search leaves the app. "Stay in RepLab" (or a tap
// on the backdrop / Escape) cancels; "Search YouTube" calls onConfirm.
export default function YouTubeSearchPrompt({ onConfirm, onClose }) {
  const trapRef = useFocusTrap(true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center px-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="yt-search-prompt-title"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        ref={trapRef}
        className="relative w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          borderRadius: '2px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25))' }} />
        <div className="px-6 pt-6 pb-2">
          <h2
            id="yt-search-prompt-title"
            className="text-[24px] font-black text-white tracking-tight uppercase"
            style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}
          >
            Leave RepLab?
          </h2>
          <p className="text-[13px] text-white/55 leading-relaxed mt-3">
            There's no demo for this exercise yet. We'll open a YouTube search for it.
          </p>
        </div>
        <div className="px-6 pt-4 pb-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-[11px] font-bold uppercase text-white/80 active:scale-[0.98] transition-transform"
            style={{ borderRadius: '2px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', letterSpacing: '0.15em' }}
          >
            Stay in RepLab
          </button>
          <button
            type="button"
            onClick={() => { onClose(); onConfirm(); }}
            className="flex-1 py-3 text-[11px] font-bold uppercase text-white active:scale-[0.98] transition-transform"
            style={{ borderRadius: '2px', border: 'none', background: 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)', letterSpacing: '0.15em' }}
          >
            Search YouTube
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
