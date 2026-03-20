import { useNavigate } from 'react-router-dom';

export default function Test() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black px-4 pt-6 pb-24">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-6 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      <h1 className="text-2xl font-black text-white mb-6">Test Page</h1>

      <div className="space-y-4">
        <p className="text-wf-gray-400 text-sm">This is a blank test page for prototyping.</p>
      </div>
    </div>
  );
}
