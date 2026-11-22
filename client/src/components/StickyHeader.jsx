import { useState, useEffect, useLayoutEffect, useRef } from 'react';

export default function StickyHeader({ title, subtitle, children, bottomContent, titleClassName = '', titleStyle, titleCentered = false, rightSlotWidth = 35 }) {
  const [collapsed, setCollapsed] = useState(false);
  const sentinelRef = useRef(null);
  const headerRef = useRef(null);
  const spacerRef = useRef(null);
  // Height of the full (expanded) header, taken while it's fully expanded.
  const expandedHeightRef = useRef(0);
  // 'expanded' | 'collapsed' | 'expanding' (growing back after a collapse).
  const modeRef = useRef('expanded');
  const syncRef = useRef(() => {});

  // The header is sticky, so it sits in the page flow: when it collapses (or
  // anything inside it changes size while collapsed) everything below would
  // shift. A spacer right under it takes up exactly the height the header
  // lost, so the content below never moves. Updated from a ResizeObserver,
  // which runs before paint, so the collapse animation is matched frame by
  // frame. Written straight to the DOM to avoid a re-render per frame.
  useLayoutEffect(() => {
    const header = headerRef.current;
    const spacer = spacerRef.current;
    if (!header || !spacer) return;
    const sync = () => {
      const h = header.getBoundingClientRect().height;
      if (modeRef.current === 'expanded') {
        expandedHeightRef.current = h;
        spacer.style.height = '0px';
      } else {
        spacer.style.height = `${Math.max(0, expandedHeightRef.current - h)}px`;
      }
    };
    syncRef.current = sync;
    sync();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(sync);
    // border-box: the collapsed header also gains a 1px border.
    ro.observe(header, { box: 'border-box' });
    return () => ro.disconnect();
  }, []);

  // Layout effect: the spacer must change in the same frame as the header,
  // before the browser paints, or the cards show one frame out of place.
  useLayoutEffect(() => {
    if (collapsed) {
      modeRef.current = 'collapsed';
      syncRef.current();
      return;
    }
    if (modeRef.current === 'expanded') return;
    // Growing back: keep filling the gap until the header's 0.3s transition
    // has finished, then take its height as the new expanded height.
    modeRef.current = 'expanding';
    syncRef.current();
    const t = setTimeout(() => {
      modeRef.current = 'expanded';
      syncRef.current();
    }, 400);
    return () => clearTimeout(t);
  }, [collapsed]);

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
        ref={headerRef}
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
      <div ref={spacerRef} aria-hidden="true" style={{ height: 0 }} />
    </>
  );
}
