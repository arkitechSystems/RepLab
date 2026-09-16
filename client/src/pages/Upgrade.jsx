import { useNavigate } from 'react-router-dom';
import StickyHeader from '../components/StickyHeader';

// REPLAB currently has no paid plans — every feature is free for every user,
// on every platform. Paid tiers (and the Stripe checkout/portal flow this
// page used to expose) may return in a future release, built properly with
// StoreKit/Play Billing on native platforms at that point. Until then this
// is a plain informational page with no purchase path, no plan comparison,
// and no platform-specific branching to reason about.
export default function Upgrade() {
  const navigate = useNavigate();

  return (
    <div>
      <StickyHeader title="Membership" />

      <div className="px-4 pb-8">
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-sm text-white/50 active:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
        </div>

        <div
          className="relative overflow-hidden mb-5"
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
              Membership
            </p>
            <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
              REPLAB IS FREE
            </h1>
            <p className="text-sm text-white/55 mt-3 leading-relaxed">
              Every feature in REPLAB is included at no cost right now — no plans, no paywalls. Enjoy the full app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
