/**
 * Callback ref that focuses an input after a short delay.
 * Works on iOS WKWebView where autoFocus doesn't trigger the keyboard.
 * Usage: <input ref={iosFocusRef} />
 */
export function iosFocusRef(el) {
  if (el) {
    setTimeout(() => el.focus(), 50);
  }
}
