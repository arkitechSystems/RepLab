const tips = [
  'Get 7-9 hours of quality sleep tonight.',
  'Stay hydrated — aim for at least 8 glasses of water.',
  'Foam roll or stretch for 10-15 minutes.',
  'Take a light walk to promote blood flow.',
  'Focus on nutrition — protein helps muscle recovery.',
  'Practice deep breathing or meditation.',
  'Avoid heavy lifting — let your muscles rebuild.',
];

export default function RestDayCard() {
  return (
    <div className="px-4 pt-6">
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-wf-purple/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-wf-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Rest Day</h2>
        </div>
        <p className="text-wf-gray-400 text-sm mb-5">
          Recovery is just as important as training. Here are some tips:
        </p>
        <div className="space-y-3">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-wf-purple mt-2 shrink-0" />
              <p className="text-sm text-white/80">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
