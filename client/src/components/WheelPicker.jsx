import { useEffect, useRef } from 'react';

// Vanilla scroll-snap wheel picker. No third-party deps — just a fixed-height
// scroll container with CSS scroll-snap-type: y mandatory. The center row is
// the "selected" position; top/bottom padding (computed from visibleCount) lets
// the first and last items snap to center as well. Native touch + wheel both
// work — no JS gesture handling required.
//
// Props
//   items          : string[] (or stringifiable[])
//   value          : currently selected item (must be in items, or initial scroll
//                    falls back to index 0)
//   onChange(next) : fired ~120ms after scroll settles
//   itemHeight     : px height per row (default 44 — comfortable tap target)
//   visibleCount   : odd integer, total rows visible (default 5)
//
// The center band is highlighted via two faint horizontal rules — same idiom as
// iOS/Android native pickers, kept understated so it harmonizes with the rest
// of the modal chrome.
export default function WheelPicker({
  items,
  value,
  onChange,
  itemHeight = 44,
  visibleCount = 5,
  ariaLabel,
}) {
  const containerRef = useRef(null);
  const scrollTimerRef = useRef(null);
  const ignoreNextSettleRef = useRef(false);

  // Normalize visibleCount to an odd integer (so the center index is unambiguous)
  const safeVisible = visibleCount % 2 === 0 ? visibleCount + 1 : visibleCount;
  const padCount = (safeVisible - 1) / 2;
  const totalHeight = safeVisible * itemHeight;

  // Scroll the container so the initial `value` sits in the center band.
  // Re-runs if `value` changes externally (parent re-renders with a new pick
  // from e.g. a Clear → A1 reset). The ignoreNext flag suppresses the
  // synthetic onChange we'd otherwise fire from our own programmatic scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.max(0, items.indexOf(value));
    ignoreNextSettleRef.current = true;
    el.scrollTop = idx * itemHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items, itemHeight]);

  function handleScroll() {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      // The item whose top sits at scrollTop is centered (because the top
      // padding offsets the visual layout by padCount * itemHeight while the
      // scroll offset itself is measured from the first item's top).
      const rawIdx = Math.round(el.scrollTop / itemHeight);
      const idx = Math.max(0, Math.min(items.length - 1, rawIdx));
      const picked = items[idx];
      if (ignoreNextSettleRef.current) {
        ignoreNextSettleRef.current = false;
        return;
      }
      if (picked !== value) onChange?.(picked);
    }, 120);
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      role="listbox"
      aria-label={ariaLabel}
      style={{
        height: totalHeight,
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        position: 'relative',
        // Hide the scrollbar — it's redundant once the snap behavior is clear.
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
      // Stop horizontal scrolling on parent from being triggered by the wheel
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Center selection band — two thin horizontal rules at the top + bottom
          of the center row. Pointer-events: none so the user can scroll through. */}
      <div
        aria-hidden="true"
        style={{
          position: 'sticky',
          top: padCount * itemHeight,
          height: itemHeight,
          marginTop: -itemHeight, // collapses sticky so it doesn't push content
          pointerEvents: 'none',
          borderTop: '1px solid rgba(239,68,68,0.4)',
          borderBottom: '1px solid rgba(239,68,68,0.4)',
          background: 'rgba(239,68,68,0.06)',
          zIndex: 1,
        }}
      />

      <div style={{ paddingTop: padCount * itemHeight, paddingBottom: padCount * itemHeight }}>
        {items.map((item, idx) => {
          const selected = item === value;
          return (
            <div
              key={`${item}-${idx}`}
              role="option"
              aria-selected={selected}
              style={{
                height: itemHeight,
                scrollSnapAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Anton', system-ui, sans-serif",
                fontSize: 28,
                lineHeight: 1,
                letterSpacing: '0.05em',
                color: selected ? '#fff' : 'rgba(255,255,255,0.45)',
                transition: 'color 120ms ease-out',
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
}
