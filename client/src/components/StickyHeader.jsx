import { useState, useEffect, useRef } from 'react';

export default function StickyHeader({ title, subtitle, children, bottomContent, titleClassName = '', titleStyle, titleCentered = false, rightSlotWidth = 35 }) {
  const [collapsed, setCollapsed] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setCollapsed(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden="true" />
      <div
        className={`sticky-header px-4 ${
          collapsed ? 'collapsed py-3' : 'pt-6 pb-4'
        }`}
      >
        <div className={titleCentered
          ? 'flex items-center justify-between gap-3'
          : 'flex items-center justify-between gap-3'
        }>
          {/* Left spacer in centered mode reserves the same width as the
              right-side children (typically a settings gear) so the title
              sits visually centered while still respecting the gear's
              footprint — this also forces long titles to wrap before
              reaching the gear instead of floating over it. We use a
              dummy-sized div (not a clone of children) so duplicated DOM
              ids/data-attributes don't confuse selectors. */}
          {titleCentered && children ? (
            <div
              className="shrink-0"
              style={{ width: rightSlotWidth, height: rightSlotWidth }}
              aria-hidden="true"
            />
          ) : null}
          {title ? <div className={`min-w-0 flex-1${titleCentered ? ' text-center' : ''}`}>
            {/* Title uses the landing page's Anton uppercase treatment so
                the in-app page titles read in the same typographic voice
                as the marketing surfaces. callers can still override
                via titleStyle / titleClassName. */}
            <h1
              className={`text-white uppercase transition-all duration-300 ${
                collapsed ? 'text-[18px]' : 'text-[28px]'
              } ${titleClassName}`}
              style={{
                fontFamily: 'Anton, sans-serif',
                fontWeight: 400,
                letterSpacing: '0.01em',
                lineHeight: 1,
                overflowWrap: 'break-word',
                ...titleStyle,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className={`text-wf-gray-400 mt-0.5 transition-all duration-300 truncate ${
                  collapsed ? 'text-xs' : 'text-sm'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div> : null}
          {children ? <div className="shrink-0">{children}</div> : null}
        </div>
        {typeof bottomContent === 'function' ? bottomContent(collapsed) : bottomContent}
      </div>
    </>
  );
}
