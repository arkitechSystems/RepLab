import { useToast } from '../context/ToastContext';
import { APP_LINK } from '../utils/shareText';

// "Or share externally" row used by every share screen in the app: Share
// (the phone's share sheet, or copy on desktop), Messenger and Instagram.
// `text` is the message sent; `onShare` replaces the Share button's default
// (e.g. a PR shares its picture instead of plain text).
export default function ExternalShareButtons({ text, onShare, showDivider = true }) {
  const showToast = useToast();

  async function defaultShare() {
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* closed the share sheet */ }
    } else {
      try { await navigator.clipboard.writeText(text); showToast('Copied to clipboard!'); } catch { /* clipboard blocked */ }
    }
  }

  return (
    <>
      {showDivider && (
        <div className="flex items-center gap-3 mt-4 mb-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-semibold">Or share externally</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onShare || defaultShare}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 active:bg-blue-500/20 transition-colors"
        >
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          <span className="text-xs font-semibold text-blue-400">Share</span>
        </button>
        <button
          type="button"
          onClick={() => {
            const encoded = encodeURIComponent(text);
            window.open(`fb-messenger://share?link=${encodeURIComponent(APP_LINK)}`, '_blank');
            setTimeout(() => window.open(`sms:?&body=${encoded}`, '_blank'), 300);
          }}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 active:bg-purple-500/20 transition-colors"
        >
          <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.908 1.438 5.503 3.688 7.2V22l3.405-1.868c.907.252 1.87.388 2.907.388 5.523 0 10-4.145 10-9.243S17.523 2 12 2zm.997 12.442l-2.548-2.717-4.972 2.717 5.47-5.806 2.612 2.717 4.908-2.717-5.47 5.806z"/>
          </svg>
          <span className="text-xs font-semibold text-purple-400">Messenger</span>
        </button>
        <button
          type="button"
          onClick={() => window.open(`https://ig.me/m?text=${encodeURIComponent(text)}`, '_blank')}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-pink-500/10 border border-pink-500/20 active:bg-pink-500/20 transition-colors"
        >
          <svg className="w-4 h-4 text-pink-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
          </svg>
          <span className="text-xs font-semibold text-pink-400">Instagram</span>
        </button>
      </div>
    </>
  );
}
