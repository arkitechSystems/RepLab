import { useEffect, useRef } from 'react';

// Trap Tab/Shift-Tab focus inside the returned ref'd container while `active`
// is true. Used by accessible modal dialogs to satisfy WCAG 2.1.2 (no keyboard
// trap escape *out* of a modal context, which is the inverse — Tab must cycle
// inside the modal until it's dismissed).
//
// Usage:
//   const ref = useFocusTrap(open);
//   return <div ref={ref} role="dialog" aria-modal="true">…</div>;
//
// The hook also captures the previously-focused element and restores focus to
// it when the modal closes, which is standard WAI-ARIA dialog behavior.
export default function useFocusTrap(active) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement;

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    function getFocusable() {
      return Array.from(container.querySelectorAll(focusableSelector)).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
      );
    }

    // Move focus into the modal so the very first Tab cycles within it.
    const focusables = getFocusable();
    if (focusables.length > 0) {
      // Don't steal focus if focus is already inside the container
      if (!container.contains(document.activeElement)) {
        focusables[0].focus();
      }
    }

    function handleKey(e) {
      if (e.key !== 'Tab') return;
      const list = getFocusable();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener('keydown', handleKey);
    return () => {
      container.removeEventListener('keydown', handleKey);
      // Restore focus to the element that was focused before the modal opened
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try { previouslyFocused.focus(); } catch (e) { /* element gone */ }
      }
    };
  }, [active]);

  return containerRef;
}
