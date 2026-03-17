import { useNavigate, useParams } from 'react-router-dom';
import { getExerciseBySlug } from '../data/exercises/index.js';
import ExerciseDetailCard from '../components/ExerciseDetailCard.jsx';

export default function ExerciseDetail() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const exercise = getExerciseBySlug(slug);

  return (
    <div className="px-4 pt-6 pb-24">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-4 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      {exercise ? (
        <ExerciseDetailCard exercise={exercise} />
      ) : (
        <div className="text-center py-16">
          <p className="text-wf-gray-500 text-sm">Exercise not found</p>
        </div>
      )}
    </div>
  );
}
