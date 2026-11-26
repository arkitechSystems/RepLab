import { createContext, useCallback, useContext, useMemo, useState, lazy, Suspense } from 'react';
import { track } from '../utils/analytics';
import { useAuth } from './AuthContext';

// One shared Help chat for the whole app. Every entry point (the "?" header
// buttons, Profile > Help & FAQ, the public Support page) calls openHelp();
// the sheet itself is rendered once, here. The chat code + FAQ data load
// only the first time it's opened.
const HelpChat = lazy(() => import('../components/HelpChat.jsx'));

const HelpChatContext = createContext(null);

export function HelpChatProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  // Signed out (public Support page): hide in-app "Show me" links.
  const { user } = useAuth();

  const openHelp = useCallback((from) => {
    setOpen(true);
    setHasOpened(true);
    track('help_chat_opened', { from: typeof from === 'string' ? from : 'unknown' });
  }, []);
  const closeHelp = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ open, openHelp, closeHelp }), [open, openHelp, closeHelp]);

  return (
    <HelpChatContext.Provider value={value}>
      {children}
      {hasOpened && open && (
        <Suspense fallback={null}>
          <HelpChat open={open} onClose={closeHelp} signedIn={!!user} />
        </Suspense>
      )}
    </HelpChatContext.Provider>
  );
}

// Safe outside the provider (isolated page tests render screens without it):
// the buttons simply do nothing there.
const NOOP = { open: false, openHelp: () => {}, closeHelp: () => {} };
export function useHelpChat() {
  return useContext(HelpChatContext) || NOOP;
}
