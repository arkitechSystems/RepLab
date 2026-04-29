import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { api } from './api';
import SplashScreen from './components/SplashScreen';
import { TutorialProvider } from './context/TutorialContext';
import { VideoPlayerProvider } from './context/VideoPlayerContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// Critical routes — loaded immediately (core user paths)
import Login from './pages/Login';
import Signup from './pages/Signup';
import Workouts from './pages/Workouts';
import Calendar from './pages/Calendar';
import WorkoutSession from './pages/WorkoutSession';

// Lazy-loaded routes — downloaded on demand
const CreateWorkout = lazy(() => import('./pages/CreateWorkout'));
const EditWorkout = lazy(() => import('./pages/EditWorkout'));
const CreateProgram = lazy(() => import('./pages/CreateProgram'));
const History = lazy(() => import('./pages/History'));
const SessionDetail = lazy(() => import('./pages/SessionDetail'));
const SessionSummary = lazy(() => import('./pages/SessionSummary'));
const Profile = lazy(() => import('./pages/Profile'));
const Utilities = lazy(() => import('./pages/Utilities'));
const Welcome = lazy(() => import('./pages/Welcome'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const FreeTrialOffer = lazy(() => import('./pages/FreeTrialOffer'));
const Upgrade = lazy(() => import('./pages/Upgrade'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AIWorkoutGenerator = lazy(() => import('./pages/AIWorkoutGenerator'));
const ExerciseLibrary = lazy(() => import('./pages/ExerciseLibrary'));
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail'));
const TutorialWorkout = lazy(() => import('./pages/TutorialWorkout'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Test pages — only loaded by test users
const Test = lazy(() => import('./pages/Test'));
const CardsTest = lazy(() => import('./pages/CardsTest'));
const WorkoutSessionTest = lazy(() => import('./pages/WorkoutSessionTest'));
const TutorialTest = lazy(() => import('./pages/TutorialTest'));
const NewWorkoutSessionTest = lazy(() => import('./pages/NewWorkoutSessionTest'));
const NeumorphicSessionTest = lazy(() => import('./pages/NeumorphicSessionTest'));
const FeaturedWorkoutSession = lazy(() => import('./pages/FeaturedWorkoutSession'));
const TestChallengeSection = lazy(() => import('./pages/TestChallengeSection'));
const NikeTestHomepage = lazy(() => import('./pages/NikeTestHomepage'));
const NikeCardsTest = lazy(() => import('./pages/NikeCardsTest'));
const RepLabFeedTest = lazy(() => import('./pages/RepLabFeedTest'));
const NewHomepage = lazy(() => import('./pages/NewHomepage'));
const Brainstorm = lazy(() => import('./pages/Brainstorm'));
const ParallaxAnimation = lazy(() => import('./pages/ParallaxAnimation'));
const NavbarsTest = lazy(() => import('./pages/NavbarsTest'));
const LoginScreensTest = lazy(() => import('./pages/LoginScreensTest'));
const PlateCalculator = lazy(() => import('./pages/PlateCalculator'));

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
  // Unauthenticated users get bounced to login (preserves the original auth gate);
  // authenticated users landing on an unknown path see the friendly 404.
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <NotFound />;
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
    <VideoPlayerProvider>
      <PageTracker />
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
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
        <Route path="/summary/:id" element={<SessionSummary />} />
        <Route path="/utilities" element={<Utilities />} />
        <Route path="/plate-calculator" element={<PlateCalculator />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/upgrade" element={<Upgrade />} />
        <Route path="/tutorial/workout" element={<TutorialWorkout />} />
        <Route path="/featured-session" element={<FeaturedWorkoutSession />} />
        <Route path="/featured-session/:workoutId" element={<FeaturedWorkoutSession />} />
        <Route path="/test" element={<TestRoute><Test /></TestRoute>} />
        <Route path="/test/cards" element={<TestRoute><CardsTest /></TestRoute>} />
        <Route path="/test/workout-session" element={<TestRoute><WorkoutSessionTest /></TestRoute>} />
        <Route path="/test/tutorial" element={<TestRoute><TutorialTest /></TestRoute>} />
        <Route path="/test/new-session" element={<TestRoute><NewWorkoutSessionTest /></TestRoute>} />
        <Route path="/test/neumorphic-session" element={<TestRoute><NeumorphicSessionTest /></TestRoute>} />
        <Route path="/test/challenge-section" element={<TestRoute><TestChallengeSection /></TestRoute>} />
        <Route path="/test/nike" element={<TestRoute><NikeTestHomepage /></TestRoute>} />
        <Route path="/test/nike-cards" element={<TestRoute><NikeCardsTest /></TestRoute>} />
        <Route path="/test/feed" element={<TestRoute><RepLabFeedTest /></TestRoute>} />
        <Route path="/test/new-homepage" element={<TestRoute><NewHomepage /></TestRoute>} />
        <Route path="/test/brainstorm" element={<TestRoute><Brainstorm /></TestRoute>} />
        <Route path="/test/parallax" element={<TestRoute><ParallaxAnimation /></TestRoute>} />
        <Route path="/test/navbars" element={<TestRoute><NavbarsTest /></TestRoute>} />
        <Route path="/test/login-screens" element={<TestRoute><LoginScreensTest /></TestRoute>} />
      </Route>

      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
    </Suspense>
    </VideoPlayerProvider>
    </TutorialProvider>
    </ErrorBoundary>
  );
}
