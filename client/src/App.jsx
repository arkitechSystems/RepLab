import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import SplashScreen from './components/SplashScreen';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Calendar from './pages/Calendar';
import WorkoutSession from './pages/WorkoutSession';
import Workouts from './pages/Workouts';
import CreateWorkout from './pages/CreateWorkout';
import EditWorkout from './pages/EditWorkout';
import CreateProgram from './pages/CreateProgram';
import History from './pages/History';
import SessionDetail from './pages/SessionDetail';
import Profile from './pages/Profile';
import Utilities from './pages/Utilities';
import Welcome from './pages/Welcome';
import ForgotPassword from './pages/ForgotPassword';
import FreeTrialOffer from './pages/FreeTrialOffer';
import Upgrade from './pages/Upgrade';
import ResetPassword from './pages/ResetPassword';
import AIWorkoutGenerator from './pages/AIWorkoutGenerator';
import ExerciseLibrary from './pages/ExerciseLibrary';
import ExerciseDetail from './pages/ExerciseDetail';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

function CatchAllRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/' : '/login'} replace />;
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  // Capture UTM params on first landing and persist until signup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const hasUtm = utmKeys.some((k) => params.get(k));
    if (hasUtm) {
      const utm = {};
      for (const k of utmKeys) {
        const val = params.get(k);
        if (val) utm[k] = val;
      }
      try { localStorage.setItem('willfit_utm', JSON.stringify(utm)); } catch {}
    }
  }, []);

  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/welcome" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
      <Route path="/free-trial" element={<ProtectedRoute><FreeTrialOffer /></ProtectedRoute>} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Workouts />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/session/:templateId/:date" element={<WorkoutSession />} />
        <Route path="/workouts/create" element={<CreateWorkout />} />
        <Route path="/workouts/ai" element={<AIWorkoutGenerator />} />
        <Route path="/exercises" element={<ExerciseLibrary />} />
        <Route path="/exercises/:slug" element={<ExerciseDetail />} />
        <Route path="/programs/create" element={<CreateProgram />} />
        <Route path="/workouts/edit/:id" element={<EditWorkout />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:id" element={<SessionDetail />} />
        <Route path="/utilities" element={<Utilities />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/upgrade" element={<Upgrade />} />
      </Route>

      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
    </>
  );
}
