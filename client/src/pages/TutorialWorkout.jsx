import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Sample workout template — not saved to the database or workout library
export const TUTORIAL_TEMPLATE = {
  id: 'tutorial',
  name: 'Tutorial Workout',
  description: 'A sample workout to learn how RepLab tracks your sets, reps, and weight.',
  exercises: [
    {
      name: 'Barbell Back Squat',
      setType: 'straight',
      sets: [
        { setNumber: 1, plannedReps: 10, suggestedWeight: 45, setType: 'warm_up' },
        { setNumber: 2, plannedReps: 8, suggestedWeight: 95, setType: 'warm_up' },
        { setNumber: 3, plannedReps: 5, suggestedWeight: 135, setType: 'warm_up' },
        { setNumber: 4, plannedReps: 5, suggestedWeight: 185, setType: 'straight' },
        { setNumber: 5, plannedReps: 5, suggestedWeight: 185, setType: 'straight' },
        { setNumber: 6, plannedReps: 5, suggestedWeight: 185, setType: 'straight' },
      ],
    },
    {
      name: 'Barbell Bench Press',
      setType: 'straight',
      sets: [
        { setNumber: 1, plannedReps: 10, suggestedWeight: 45, setType: 'warm_up' },
        { setNumber: 2, plannedReps: 8, suggestedWeight: 95, setType: 'warm_up' },
        { setNumber: 3, plannedReps: 5, suggestedWeight: 135, setType: 'warm_up' },
        { setNumber: 4, plannedReps: 6, suggestedWeight: 165, setType: 'straight' },
        { setNumber: 5, plannedReps: 6, suggestedWeight: 165, setType: 'straight' },
        { setNumber: 6, plannedReps: 6, suggestedWeight: 165, setType: 'straight' },
        { setNumber: 7, plannedReps: 0, suggestedWeight: 115, setType: 'drop' },
      ],
    },
    {
      name: 'Deadlift',
      setType: 'straight',
      sets: [
        { setNumber: 1, plannedReps: 5, suggestedWeight: 95, setType: 'warm_up' },
        { setNumber: 2, plannedReps: 5, suggestedWeight: 135, setType: 'warm_up' },
        { setNumber: 3, plannedReps: 3, suggestedWeight: 185, setType: 'warm_up' },
        { setNumber: 4, plannedReps: 5, suggestedWeight: 225, setType: 'straight' },
        { setNumber: 5, plannedReps: 5, suggestedWeight: 225, setType: 'straight' },
        { setNumber: 6, plannedReps: 5, suggestedWeight: 225, setType: 'rest_pause' },
      ],
    },
    {
      name: 'Overhead Shoulder Press',
      setType: 'straight',
      sets: [
        { setNumber: 1, plannedReps: 8, suggestedWeight: 45, setType: 'warm_up' },
        { setNumber: 2, plannedReps: 5, suggestedWeight: 65, setType: 'warm_up' },
        { setNumber: 3, plannedReps: 8, suggestedWeight: 95, setType: 'straight' },
        { setNumber: 4, plannedReps: 8, suggestedWeight: 95, setType: 'straight' },
        { setNumber: 5, plannedReps: 8, suggestedWeight: 95, setType: 'straight' },
      ],
    },
    {
      name: 'Lat Pulldown',
      setType: 'straight',
      sets: [
        { setNumber: 1, plannedReps: 12, suggestedWeight: 0, setType: 'straight' },
        { setNumber: 2, plannedReps: 12, suggestedWeight: 0, setType: 'straight' },
        { setNumber: 3, plannedReps: 12, suggestedWeight: 0, setType: 'drop' },
      ],
    },
  ],
};

// Redirects to the WorkoutSession component in tutorial mode
export default function TutorialWorkout() {
  const navigate = useNavigate();

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    navigate(`/session/tutorial/${today}`, { replace: true, state: { tutorialTemplate: TUTORIAL_TEMPLATE } });
  }, [navigate]);

  return null;
}
