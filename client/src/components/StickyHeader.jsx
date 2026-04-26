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
            <h1
              className={`font-black text-white tracking-tight transition-all duration-300 ${
                collapsed ? 'text-lg' : 'text-3xl'
              } ${titleClassName}`}
              style={{ overflowWrap: 'break-word', ...titleStyle }}
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
