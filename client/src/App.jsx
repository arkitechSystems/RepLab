import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { api } from './api';
import SplashScreen from './components/SplashScreen';
import { TutorialProvider } from './context/TutorialContext';
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
import Test from './pages/Test';
import ExerciseDetail from './pages/ExerciseDetail';
import CardsTest from './pages/CardsTest';
import WorkoutSessionTest from './pages/WorkoutSessionTest';
import WorkoutSessionCardTest from './pages/WorkoutSessionCardTest';
import SectionHeaderTest from './pages/SectionHeaderTest';
import TutorialWorkout from './pages/TutorialWorkout';
import TutorialTest from './pages/TutorialTest';
import NewWorkoutSessionTest from './pages/NewWorkoutSessionTest';
import NeumorphicSessionTest from './pages/NeumorphicSessionTest';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import ErrorBoundary from './components/ErrorBoundary';

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

const TEST_EMAILS = ['willmartinmail@gmail.com', 'abilenerentals@gmail.com'];
function TestRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || !user?.email || !TEST_EMAILS.includes(user.email.toLowerCase())) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function CatchAllRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/' : '/login'} replace />;
}

function PageTracker() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const lastPath = useRef(null);
  useEffect(() => {
    if (!isAuthenticated) return;
    const path = location.pathname;
    if (path === lastPath.current) return;
    lastPath.current = path;
    api('/auth/page-visit', { method: 'POST', body: JSON.stringify({ path }) }).catch(() => {});
  }, [location.pathname, isAuthenticated]);
  return null;
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
      try { localStorage.setItem('replab_utm', JSON.stringify(utm)); } catch {}
    }
  }, []);

  return (
    <ErrorBoundary>
    <TutorialProvider>
      <PageTracker />
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
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
        <Route path="/clientworkouts/create" element={<CreateWorkout />} />
        <Route path="/clientworkouts/ai" element={<AIWorkoutGenerator />} />
        <Route path="/exercises" element={<ExerciseLibrary />} />
        <Route path="/exercises/:slug" element={<ExerciseDetail />} />
        <Route path="/programs/create" element={<CreateProgram />} />
        <Route path="/clientworkouts/edit/:id" element={<EditWorkout />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:id" element={<SessionDetail />} />
        <Route path="/utilities" element={<Utilities />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/upgrade" element={<Upgrade />} />
        <Route path="/tutorial/workout" element={<TutorialWorkout />} />
        <Route path="/test" element={<TestRoute><Test /></TestRoute>} />
        <Route path="/test/cards" element={<TestRoute><CardsTest /></TestRoute>} />
        <Route path="/test/workout-session" element={<TestRoute><WorkoutSessionTest /></TestRoute>} />
        <Route path="/test/workout-session-card" element={<TestRoute><WorkoutSessionCardTest /></TestRoute>} />
        <Route path="/test/section-header" element={<TestRoute><SectionHeaderTest /></TestRoute>} />
        <Route path="/test/tutorial" element={<TestRoute><TutorialTest /></TestRoute>} />
        <Route path="/test/new-session" element={<TestRoute><NewWorkoutSessionTest /></TestRoute>} />
        <Route path="/test/neumorphic-session" element={<TestRoute><NeumorphicSessionTest /></TestRoute>} />
      </Route>

      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
    </TutorialProvider>
    </ErrorBoundary>
  );
}
