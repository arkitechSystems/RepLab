import { useNavigate, useParams } from 'react-router-dom';
import { getExerciseBySlug } from '../data/exercises/index.js';
import ExerciseDetailCard from '../components/ExerciseDetailCard.jsx';

export default function ExerciseDetail() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const exercise = getExerciseBySlug(slug);

  return (
    <div className="px-4 pt-6 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors mb-5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      {exercise ? (
        <>
          <div
            className="relative overflow-hidden mb-4 fade-slide-up"
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div
              className="h-[3px]"
              style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }}
            />
            <div
              className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)',
                filter: 'blur(40px)',
              }}
            />
            <div className="relative p-6">
              <p
                className="text-[10px] uppercase font-light mb-1"
                style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}
              >
                Exercise
              </p>
              <h1
                className="text-[28px] font-black text-white tracking-tight"
                style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}
              >
                {(exercise.name || 'EXERCISE').toUpperCase()}
              </h1>
              {exercise.muscle && (
                <p className="text-[12px] text-white/40 font-light mt-2 leading-relaxed">
                  <span
                    className="uppercase font-bold"
                    style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}
                  >
                    {exercise.muscle}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div
            className="relative overflow-hidden fade-slide-up"
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="relative p-5">
              <ExerciseDetailCard exercise={exercise} />
            </div>
          </div>
        </>
      ) : (
        <div
          className="relative overflow-hidden fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div
            className="h-[3px]"
            style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }}
          />
          <div className="relative p-10 text-center">
            <p
              className="text-[10px] uppercase font-light mb-2"
              style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}
            >
              Not Found
            </p>
            <p className="text-wf-gray-400 text-sm">Exercise not found</p>
          </div>
        </div>
      )}
    </div>
  );
}
