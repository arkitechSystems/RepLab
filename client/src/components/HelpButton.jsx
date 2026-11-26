import { useHelpChat } from '../context/HelpChatContext';

// "?" icon for the main tab headers (Workouts, Schedule, Utilities). Same
// size and look as the Workouts search button; opens the shared Help chat.
export default function HelpButton({ from, className = '' }) {
  const { openHelp } = useHelpChat();
  return (
    <button
      type="button"
      onClick={() => openHelp(from)}
      aria-label="Help"
      title="Help"
      data-testid="help-button"
      className={`w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center active:scale-90 transition-all shrink-0 ${className}`}
    >
      <svg className="w-5 h-5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    </button>
  );
}
