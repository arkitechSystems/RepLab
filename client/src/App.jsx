import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './context/AuthContext';
import { api } from './api';
import SplashScreen from './components/SplashScreen';
import { TutorialProvider } from './context/TutorialContext';
import { VideoPlayerProvider } from './context/VideoPlayerContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// Stale-chunk recovery: when a new build is deployed, the running tab's
// `index-*.js` still references chunk hashes that no longer exist on the
// server (the SPA fallback returns index.html instead, and the browser
// fails to parse HTML as JS). Wrap every dynamic import with one retry +
// reload so users on stale tabs get bumped to the new build automatically
// instead of seeing a blank screen. Uses sessionStorage to guarantee at
// most one reload per session — anything failing twice is a real bug and
// gets re-thrown so the ErrorBoundary catches it.
function lazyWithRetry(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem('chunk-reload-attempted');
      return mod;
    } catch (err) {
      const already = sessionStorage.getItem('chunk-reload-attempted');
      if (!already) {
        sessionStorage.setItem('chunk-reload-attempted', '1');
        window.location.reload();
        // Return a placeholder so React doesn't crash before the reload
        // commits. Suspense will keep showing fallback during the brief
        // window between reload() being called and the page actually nav'ing.
        return { default: () => null };
      }
      throw err;
    }
  });
}

// Critical routes — loaded immediately (core user paths)
import Login from './pages/Login';
import Signup from './pages/Signup';
import Workouts from './pages/Workouts';
import Calendar from './pages/Calendar';
import WorkoutSession from './pages/WorkoutSession';

// Lazy-loaded routes — downloaded on demand
const CreateWorkout = lazyWithRetry(() => import('./pages/CreateWorkout'));
const EditWorkout = lazyWithRetry(() => import('./pages/EditWorkout'));
const CreateProgram = lazyWithRetry(() => import('./pages/CreateProgram'));
const History = lazyWithRetry(() => import('./pages/History'));
const SessionDetail = lazyWithRetry(() => import('./pages/SessionDetail'));
const SessionSummary = lazyWithRetry(() => import('./pages/SessionSummary'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Utilities = lazyWithRetry(() => import('./pages/Utilities'));
const Welcome = lazyWithRetry(() => import('./pages/Welcome'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const FreeTrialOffer = lazyWithRetry(() => import('./pages/FreeTrialOffer'));
const Upgrade = lazyWithRetry(() => import('./pages/Upgrade'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const AIWorkoutGenerator = lazyWithRetry(() => import('./pages/AIWorkoutGenerator'));
const ExerciseLibrary = lazyWithRetry(() => import('./pages/ExerciseLibrary'));
const ExerciseDetail = lazyWithRetry(() => import('./pages/ExerciseDetail'));
const TutorialWorkout = lazyWithRetry(() => import('./pages/TutorialWorkout'));
const Terms = lazyWithRetry(() => import('./pages/Terms'));
const Privacy = lazyWithRetry(() => import('./pages/Privacy'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));
const WaitingList = lazyWithRetry(() => import('./pages/WaitingList'));
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));

// Test pages — only loaded by test users
const Test = lazyWithRetry(() => import('./pages/Test'));
const CardsTest = lazyWithRetry(() => import('./pages/CardsTest'));
const WorkoutSessionTest = lazyWithRetry(() => import('./pages/WorkoutSessionTest'));
const TutorialTest = lazyWithRetry(() => import('./pages/TutorialTest'));
const FeaturedWorkoutSession = lazyWithRetry(() => import('./pages/FeaturedWorkoutSession'));
const TestChallengeSection = lazyWithRetry(() => import('./pages/TestChallengeSection'));
const NikeTestHomepage = lazyWithRetry(() => import('./pages/NikeTestHomepage'));
const NikeCardsTest = lazyWithRetry(() => import('./pages/NikeCardsTest'));
const RepLabFeedTest = lazyWithRetry(() => import('./pages/RepLabFeedTest'));
const NewHomepage = lazyWithRetry(() => import('./pages/NewHomepage'));
const Brainstorm = lazyWithRetry(() => import('./pages/Brainstorm'));
const ParallaxAnimation = lazyWithRetry(() => import('./pages/ParallaxAnimation'));
const NavbarsTest = lazyWithRetry(() => import('./pages/NavbarsTest'));
const LoginScreensTest = lazyWithRetry(() => import('./pages/LoginScreensTest'));
const ProgressiveOverloadTest = lazyWithRetry(() => import('./pages/ProgressiveOverloadTest'));
const LandingPageTest = lazyWithRetry(() => import('./pages/LandingPageTest'));
const LandingPageAuroraTest = lazyWithRetry(() => import('./pages/LandingPageAuroraTest'));
const PlateCalculator = lazyWithRetry(() => import('./pages/PlateCalculator'));
const Progress = lazyWithRetry(() => import('./pages/Progress'));
const Community = lazyWithRetry(() => import('./pages/Community'));

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

// Root URL ('/') gateway. Picks between the marketing landing page and the
// authenticated dashboard based on platform + auth state:
//   - Capacitor (iOS / Android wrappers): never show marketing, always go
//     straight to login or dashboard. Mobile users already installed the
//     app — they don't need a sales page.
//   - Web, authenticated:   render the dashboard (Workouts) inside Layout.
//   - Web, not authenticated: render the public LandingPage.
// Works because Layout accepts an optional children prop in addition to the
// usual &lt;Outlet /&gt; pattern, so we can wrap Workouts here without nesting
// under a Route.
function HomeRoute() {
  const { isAuthenticated } = useAuth();
  if (Capacitor.isNativePlatform()) {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <Layout><Workouts /></Layout>;
  }
  if (!isAuthenticated) return <LandingPage />;
  return <Layout><Workouts /></Layout>;
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
      <Route path="/waiting-list" element={<WaitingList />} />
      <Route path="/welcome" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
      <Route path="/free-trial" element={<ProtectedRoute><FreeTrialOffer /></ProtectedRoute>} />

      {/* Root URL is conditional — see HomeRoute. Authed users get the
          dashboard wrapped in Layout (children form); unauth web visitors
          see the marketing LandingPage; Capacitor users skip the landing
          and bounce to /login if not authed. */}
      <Route path="/" element={<HomeRoute />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
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
        <Route path="/community" element={<Community />} />
        <Route path="/plate-calculator" element={<PlateCalculator />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/upgrade" element={<Upgrade />} />
        <Route path="/tutorial/workout" element={<TutorialWorkout />} />
        <Route path="/featured-session" element={<FeaturedWorkoutSession />} />
        <Route path="/featured-session/:workoutId" element={<FeaturedWorkoutSession />} />
        <Route path="/test" element={<TestRoute><Test /></TestRoute>} />
        <Route path="/test/cards" element={<TestRoute><CardsTest /></TestRoute>} />
        <Route path="/test/workout-session" element={<TestRoute><WorkoutSessionTest /></TestRoute>} />
        <Route path="/test/tutorial" element={<TestRoute><TutorialTest /></TestRoute>} />
        <Route path="/test/challenge-section" element={<TestRoute><TestChallengeSection /></TestRoute>} />
        <Route path="/test/nike" element={<TestRoute><NikeTestHomepage /></TestRoute>} />
        <Route path="/test/nike-cards" element={<TestRoute><NikeCardsTest /></TestRoute>} />
        <Route path="/test/feed" element={<TestRoute><RepLabFeedTest /></TestRoute>} />
        <Route path="/test/new-homepage" element={<TestRoute><NewHomepage /></TestRoute>} />
        <Route path="/test/brainstorm" element={<TestRoute><Brainstorm /></TestRoute>} />
        <Route path="/test/parallax" element={<TestRoute><ParallaxAnimation /></TestRoute>} />
        <Route path="/test/navbars" element={<TestRoute><NavbarsTest /></TestRoute>} />
        <Route path="/test/login-screens" element={<TestRoute><LoginScreensTest /></TestRoute>} />
        <Route path="/test/progressive-overload" element={<TestRoute><ProgressiveOverloadTest /></TestRoute>} />
        <Route path="/test/landing" element={<TestRoute><LandingPageTest /></TestRoute>} />
        <Route path="/test/landing-aurora" element={<TestRoute><LandingPageAuroraTest /></TestRoute>} />
      </Route>

      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
    </Suspense>
    </VideoPlayerProvider>
    </TutorialProvider>
    </ErrorBoundary>
  );
}
