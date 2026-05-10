// Official-style "Download on the App Store" + "GET IT ON Google Play"
// badges, rendered as inline SVG so they scale cleanly and don't need an
// asset pipeline. Visually mirrors Apple's + Google's standard marketing
// badges (black background, white border, brand glyph, two-line label).
//
// Both badges are disabled pre-launch — they render as the canonical visual
// but are non-interactive (cursor-not-allowed + title tooltip). Once the
// apps are live in their stores, flip the disabled prop off and wire each
// to its store URL via the href prop.

function AppStoreBadge({ href, disabled = true }) {
  const Tag = href && !disabled ? 'a' : 'button';
  const tagProps = href && !disabled
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { disabled };
  return (
    <Tag
      {...tagProps}
      aria-label="Download on the App Store"
      title={disabled ? 'Coming soon to the App Store' : 'Download on the App Store'}
      className={`inline-flex items-center gap-2.5 h-[52px] px-3.5 rounded-[10px] select-none transition-all ${
        disabled ? 'cursor-not-allowed opacity-90' : 'cursor-pointer active:scale-[0.97]'
      }`}
      style={{
        background: '#000',
        border: '1px solid rgba(255,255,255,0.6)',
        textDecoration: 'none',
      }}
    >
      <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
      <div className="text-left leading-none flex flex-col justify-center" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
        <span className="text-[9px] text-white/95 mb-[3px] tracking-tight">Download on the</span>
        <span className="text-[18px] font-semibold text-white tracking-[-0.01em]">App Store</span>
      </div>
    </Tag>
  );
}

function GooglePlayBadge({ href, disabled = true }) {
  const Tag = href && !disabled ? 'a' : 'button';
  const tagProps = href && !disabled
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { disabled };
  return (
    <Tag
      {...tagProps}
      aria-label="Get it on Google Play"
      title={disabled ? 'Coming soon to Google Play' : 'Get it on Google Play'}
      className={`inline-flex items-center gap-2.5 h-[52px] px-3.5 rounded-[10px] select-none transition-all ${
        disabled ? 'cursor-not-allowed opacity-90' : 'cursor-pointer active:scale-[0.97]'
      }`}
      style={{
        background: '#000',
        border: '1px solid rgba(255,255,255,0.6)',
        textDecoration: 'none',
      }}
    >
      {/* Google Play multi-color play-triangle glyph. Four panels meeting at
          the right apex — blue (top-left), green (bottom-left), red (right),
          yellow (top-right). Approximates the official Material Design icon. */}
      <svg className="w-6 h-6 shrink-0" viewBox="0 0 60 60" aria-hidden="true">
        <defs>
          <linearGradient id="gp-blue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00A0FF" />
            <stop offset="100%" stopColor="#00DCFA" />
          </linearGradient>
          <linearGradient id="gp-green" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00A071" />
            <stop offset="100%" stopColor="#00F076" />
          </linearGradient>
          <linearGradient id="gp-yellow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFBD00" />
            <stop offset="100%" stopColor="#FFE000" />
          </linearGradient>
          <linearGradient id="gp-red" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF3A44" />
            <stop offset="100%" stopColor="#C31162" />
          </linearGradient>
        </defs>
        <path d="M2 2 L33 30 L2 58 Z" fill="url(#gp-blue)" />
        <path d="M2 58 L33 30 L45 42 Z" fill="url(#gp-green)" />
        <path d="M2 2 L33 30 L45 18 Z" fill="url(#gp-yellow)" />
        <path d="M45 18 L58 30 L45 42 Z" fill="url(#gp-red)" />
      </svg>
      <div className="text-left leading-none flex flex-col justify-center" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
        <span className="text-[9px] text-white/95 mb-[3px] tracking-tight">GET IT ON</span>
        <span className="text-[18px] font-semibold text-white tracking-[-0.01em]">Google Play</span>
      </div>
    </Tag>
  );
}

export default function AppStoreBadges({ appStoreHref, googlePlayHref, disabled = true, className = '' }) {
  return (
    <div className={`flex flex-row gap-3 justify-center items-center ${className}`}>
      <AppStoreBadge href={appStoreHref} disabled={disabled} />
      <GooglePlayBadge href={googlePlayHref} disabled={disabled} />
    </div>
  );
}

export { AppStoreBadge, GooglePlayBadge };
