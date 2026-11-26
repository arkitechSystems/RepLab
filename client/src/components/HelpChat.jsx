import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useFocusTrap from '../hooks/useFocusTrap';
import { searchHelp, getFaqById } from '../utils/helpSearch';
import { HELP_STARTER_IDS } from '../data/helpFaq';
import { track } from '../utils/analytics';

// Offline FAQ "help chat". A bottom sheet (full screen on small phones) that
// matches typed questions against client/src/data/helpFaq.js with no network
// and no AI. History lives only in component state — closing the sheet
// clears it. Opened through HelpChatContext (one instance for the app).

export const SUPPORT_EMAIL = 'support@replab-fitness.com';
const MAX_QUERY_LOG = 200;

let nextId = 1;
const msgId = () => `m${nextId++}`;

// Follow the visual viewport so the input bar stays above the on-screen
// keyboard (iOS shrinks the visual viewport instead of resizing the page).
function useVisualViewport() {
  const read = () => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return null;
    return { height: vv.height, offsetTop: vv.offsetTop };
  };
  const [box, setBox] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const update = () => setBox({ height: vv.height, offsetTop: vv.offsetTop });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return box;
}

function Chip({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left text-[13px] leading-snug text-white bg-white/[0.06] border border-white/15 px-3 py-2 active:scale-[0.98] active:bg-white/10 transition-all"
      style={{ borderRadius: 2 }}
    >
      {children}
    </button>
  );
}

function AnswerText({ text }) {
  const lines = String(text).split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const step = line.match(/^(\d+)\.\s+(.*)$/);
        if (step) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-wf-red font-bold tabular-nums shrink-0">{step[1]}.</span>
              <span>{step[2]}</span>
            </div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export default function HelpChat({ open = true, onClose, signedIn = true }) {
  const navigate = useNavigate();
  const trapRef = useFocusTrap(open);
  const viewport = useVisualViewport();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const starters = HELP_STARTER_IDS.map(getFaqById).filter(Boolean);

  // Escape closes; lock the page behind the sheet from scrolling.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Keep the newest message in view.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, viewport?.height]);

  if (!open) return null;

  const answerWith = (entry, via) => {
    track('help_chat_answered', { faq_id: entry.id, via });
    return { id: msgId(), role: 'bot', kind: 'answer', entry };
  };

  const ask = (text) => {
    const query = String(text || '').trim();
    if (!query) return;
    const userMsg = { id: msgId(), role: 'user', text: query };
    const result = searchHelp(query);
    let botMsg;
    if (result.status === 'answer') {
      botMsg = answerWith(result.match, 'typed');
    } else if (result.status === 'suggest') {
      botMsg = { id: msgId(), role: 'bot', kind: 'suggest', suggestions: result.suggestions };
    } else {
      track('help_chat_unmatched', { query: query.slice(0, MAX_QUERY_LOG) });
      botMsg = { id: msgId(), role: 'bot', kind: 'none' };
    }
    setMessages((m) => [...m, userMsg, botMsg]);
    setDraft('');
  };

  const pick = (entry) => {
    setMessages((m) => [
      ...m,
      { id: msgId(), role: 'user', text: entry.question },
      answerWith(entry, 'chip'),
    ]);
  };

  const showMe = (to) => {
    onClose?.();
    navigate(to);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    ask(draft);
  };

  // Position the overlay over the visible part of the screen only.
  // Keyboard up: the safe-area gap under the input is no longer needed.
  const keyboardOpen = !!viewport && window.innerHeight - viewport.height > 120;
  const overlayStyle = viewport
    ? { top: viewport.offsetTop, height: viewport.height, left: 0, right: 0 }
    : { inset: 0 };

  const suggestionChips = (list) => (
    <div className="flex flex-col items-start gap-2 mt-2">
      {list.map((e) => (
        <Chip key={e.id} onClick={() => pick(e)}>{e.question}</Chip>
      ))}
    </div>
  );

  const sheet = (
    <div className="fixed z-[10000]" style={overlayStyle} data-testid="help-chat">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-chat-title"
        className="help-sheet absolute left-0 right-0 bottom-0 mx-auto flex flex-col bg-[#0c0c0b] border border-white/10 shadow-2xl"
        style={{ borderRadius: '2px 2px 0 0' }}
      >
        {/* Header */}
        <div className="help-sheet-header flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 bg-wf-red" aria-hidden="true" />
            <h2 id="help-chat-title" className="text-white text-lg uppercase" style={{ fontFamily: 'Anton, sans-serif', letterSpacing: '0.02em' }}>
              Help
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="w-10 h-10 bg-white/10 flex items-center justify-center active:scale-90 transition-all"
            style={{ borderRadius: 2 }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3" aria-live="polite">
          <div className="max-w-[88%] bg-white/[0.06] border border-white/10 px-3 py-2.5 text-[14px] leading-relaxed text-white/90" style={{ borderRadius: 2 }}>
            <p>Hi! Ask me how to do something in RepLab, or tap a question below.</p>
            {suggestionChips(starters)}
          </div>

          {messages.map((m) => {
            if (m.role === 'user') {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] bg-wf-red/90 text-white px-3 py-2 text-[14px] leading-relaxed break-words" style={{ borderRadius: 2 }}>
                    {m.text}
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className="max-w-[88%] bg-white/[0.06] border border-white/10 px-3 py-2.5 text-[14px] leading-relaxed text-white/90" style={{ borderRadius: 2 }} data-testid="help-bot-message">
                {m.kind === 'answer' && (
                  <>
                    <p className="text-white font-semibold mb-1.5">{m.entry.question}</p>
                    <AnswerText text={m.entry.answer} />
                    {m.entry.action && signedIn && (
                      <button
                        type="button"
                        onClick={() => showMe(m.entry.action.to)}
                        className="btn-create mt-3 px-4 py-2 active:scale-[0.97] transition-all"
                      >
                        {m.entry.action.label || 'Show me'}
                      </button>
                    )}
                  </>
                )}
                {m.kind === 'suggest' && (
                  <>
                    <p>I'm not sure I understood. Did you mean…</p>
                    {suggestionChips(m.suggestions)}
                  </>
                )}
                {m.kind === 'none' && (
                  <>
                    <p>Sorry, I don't have an answer for that yet. Try different words, pick a question below, or email us and we'll help.</p>
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="btn-create inline-block mt-3 px-4 py-2 active:scale-[0.97] transition-all"
                    >
                      Contact support
                    </a>
                    {suggestionChips(starters.slice(0, 4))}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Input */}
        <form onSubmit={onSubmit} className={`help-sheet-input${keyboardOpen ? ' kb-open' : ''} shrink-0 flex items-center gap-2 px-3 pt-3 border-t border-white/10 bg-[#0c0c0b]`}>
          <label htmlFor="help-chat-input" className="sr-only">Ask a question</label>
          <input
            id="help-chat-input"
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question…"
            autoComplete="off"
            enterKeyHint="send"
            maxLength={300}
            className="flex-1 min-w-0 bg-white/[0.06] border border-white/15 text-white placeholder:text-white/40 px-3 py-2.5 outline-none focus:border-wf-red"
            style={{ fontSize: 16, borderRadius: 2 }}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="btn-create px-4 py-3 shrink-0 active:scale-[0.97] transition-all"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
