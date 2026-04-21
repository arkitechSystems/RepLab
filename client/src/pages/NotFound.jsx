import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="ambient-bg" />

      {/* Faint giant 404 backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      >
        <span className="text-[22rem] leading-none font-black tracking-tighter text-white/[0.03]">
          404
        </span>
      </div>

      <div className="relative z-10 w-full max-w-sm text-center flex flex-col items-center gap-6">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-wf-red">
          404 — Off Route
        </span>

        <h1 className="text-6xl sm:text-7xl font-black text-white tracking-tighter leading-none">
          WRONG
          <br />
          <span className="bg-gradient-to-r from-wf-red via-orange-500 to-wf-red bg-clip-text text-transparent">
            REP
          </span>
        </h1>

        <p className="text-wf-gray-400 text-base leading-relaxed">
          That page doesn&apos;t exist.
        </p>

        <div className="w-full flex flex-col gap-3 mt-2">
          <button
            onClick={() => navigate('/')}
            className="w-full btn-gradient active:scale-[0.98] text-white font-bold py-4 rounded-xl text-base tracking-wide transition-all"
          >
            Back to training
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full text-wf-gray-400 hover:text-white text-sm font-medium py-2 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
