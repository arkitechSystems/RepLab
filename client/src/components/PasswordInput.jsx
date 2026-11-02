import { forwardRef, useState } from 'react';

// Password field with a show/hide "eye" button inside it on the right.
// Every prop goes straight to the <input>, so each field keeps its own look
// (className / style) and behavior (autoComplete, onKeyDown, ref, aria-*).
// Only `type` is owned here. Extra right padding keeps text out from under
// the icon. `wrapperClassName` / `wrapperStyle` style the positioning wrapper
// — put outer margins there (not on the input) so the icon stays centered.
const PasswordInput = forwardRef(function PasswordInput(
  { wrapperClassName, wrapperStyle, style, ...inputProps },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={wrapperClassName} style={{ position: 'relative', ...wrapperStyle }}>
      <input
        {...inputProps}
        ref={ref}
        type={visible ? 'text' : 'password'}
        style={{ ...style, paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        // Keep focus (and the iOS keyboard) on the input when tapping the eye.
        onMouseDown={e => e.preventDefault()}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={inputProps.id}
        className="text-white/50 hover:text-white/80 transition-colors"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 44,
          minHeight: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
});

export default PasswordInput;

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
};

function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9" />
      <path d="M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M2 2l20 20" />
    </svg>
  );
}
