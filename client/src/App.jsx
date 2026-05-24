import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { SplashScreen as CapSplashScreen } from '@capacitor/splash-screen';
import { useAuth } from './context/AuthContext';
import { api } from './api';
import SplashScreen from './components/SplashScreen';
import { TutorialProvider } from './context/TutorialContext';
import { VideoPlayerProvider } from './context/VideoPlayerContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { useFeatureFlag, FF_FEATURED } from './utils/featureFlags';
import { initDeepLinks } from './utils/deepLink';

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
const Support = lazyWithRetry(() => import('./pages/Support'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));
const WaitingList = lazyWithRetry(() => import('./pages/WaitingList'));
const LandingPage = lazyWithRetry(() => import('./pages/LandingPage'));
const DeleteAccountWeb = lazyWithRetry(() => import('./pages/DeleteAccountWeb'));
const AccountDeleted = lazyWithRetry(() => import('./pages/AccountDeleted'));
const AccountDeletionFailed = lazyWithRetry(() => import('./pages/AccountDeletionFailed'));

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
const RequestTrainerTest = lazyWithRetry(() => import('./pages/RequestTrainerTest'));
const MuscleDiagramsTest = lazyWithRetry(() => import('./pages/MuscleDiagramsTest'));
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
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return children;
}

const TEST_EMAILS = ['willmartinmail@gmail.com', 'abilenerentals@gmail.com'];
function TestRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  // Hard production gate: in prod builds (including the Play Store pre-launch
  // UI fuzzer, which crawls every route as an unauthenticated/synthetic user),
  // refuse to render test surfaces at all so a crash in an experimental page
  // can't sink the submission.
  if (import.meta.env.PROD) return <Navigate to="/" replace />;
  if (!isAuthenticated || !user?.email || !TEST_EMAILS.includes(user.email.toLowerCase())) {
    return <Navigate to="/app" replace />;
  }
  return children;
}

// Pre-launch gate for the Featured Workouts experience. Renders the
// wrapped page only when the `featured` client-side feature flag is set
// (see client/src/utils/featureFlags.js for unlock instructions). For
// every other visitor — including the Apple App Review demo account and
// any deep-link / stale navigation that lands on /featured-session —
// silently redirects back to /app, so the feature is unreachable from
// any entry point until launch.
function FeaturedGate({ children }) {
  const unlocked = useFeatureFlag(FF_FEATURED);
  if (!unlocked) return <Navigate to="/app" replace />;
  return children;
}

function CatchAllRedirect() {
  const { isAuthenticated } = useAuth();
  // Unauthenticated users get bounced to login (preserves the original auth gate);
  // authenticated users landing on an unknown path see the friendly 404.
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <NotFound />;
}

// Runtime native-platform check. Uses window.Capacitor so it gracefully
// returns false in the web bundle where the Capacitor SDK may not be present;
// avoids forcing a hard import for the marketing-only path.
function isNativePlatform() {
  return (
    typeof window !== 'undefined' &&
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform()
  );
}

// Root URL ('/') gateway. The web treats '/' as the marketing landing page
// for EVERYONE — logged-in users typing replab-fitness.com still see the
// public landing (it shows them a "Go to Web App" CTA into /app). Native
// (Capacitor) bundles bypass the landing entirely:
//   - Native + authenticated: redirect to /app (dashboard).
//   - Native + logged-out: redirect to /login.
//   - Web (any auth state): render the public LandingPageTest. The landing
//     itself handles the CTA swap based on isAuthenticated.
function RootRoute() {
  const { isAuthenticated } = useAuth();
  if (isNativePlatform()) {
    return <Navigate to={isAuthenticated ? '/app' : '/login'} replace />;
  }
  return <LandingPageTest />;
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
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [splashDone, setSplashDone] = useState(false);

  // Splash only gates entry to the app proper — the mobile (Capacitor) launch
  // and the authed web dashboard. All public web surfaces (marketing landing,
  // /login, /signup, /waiting-list, /privacy, /terms, etc.) skip splash so
  // visitors see content immediately. Once dismissed in a session it stays
  // dismissed across subsequent route changes. The path check matters for
  // authed users hitting `/` — without it they'd see splash on the marketing
  // landing every visit.
  const PUBLIC_SURFACES = ['/', '/login', '/signup', '/forgot-password', '/waiting-list', '/privacy', '/terms', '/support', '/delete-account', '/account-deleted', '/account-deletion-failed'];
  const isPublicSurface =
    PUBLIC_SURFACES.includes(location.pathname) ||
    location.pathname.startsWith('/reset-password/');
  const isAppContext =
    !isPublicSurface && (Capacitor.isNativePlatform() || isAuthenticated);

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

  // Native bootstrap: hide the Capacitor splash once the SPA is mounted.
  // `launchAutoHide: false` in capacitor.config.json keeps the launch image
  // visible until we dismiss it — without this call iOS + Android hang on
  // the splash forever. Swallow any rejection (already-hidden is harmless).
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      CapSplashScreen.hide().catch(() => {});
    }
  }, []);

  // Native bootstrap: wire Universal Links (iOS) / App Links (Android) into
  // React Router so external links to replab-fitness.com routes activate the
  // corresponding in-app screen. No-op on web. See utils/deepLink.js.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      initDeepLinks(navigate);
    }
  }, [navigate]);

  return (
    <ErrorBoundary>
    <TutorialProvider>
    <VideoPlayerProvider>
      <PageTracker />
      {isAppContext && !splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/support" element={<Support />} />
      <Route path="/waiting-list" element={<WaitingList />} />
      {/* Public web account-deletion flow (Google Play 2024 policy compliance).
          Reachable by users who don't have the app installed; the in-app
          flow (Profile > Delete Account) is unaffected. */}
      <Route path="/delete-account" element={<DeleteAccountWeb />} />
      <Route path="/account-deleted" element={<AccountDeleted />} />
      <Route path="/account-deletion-failed" element={<AccountDeletionFailed />} />
      <Route path="/welcome" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
      <Route path="/free-trial" element={<ProtectedRoute><FreeTrialOffer /></ProtectedRoute>} />

      {/* Root URL — see RootRoute. The web always renders the marketing
          LandingPageTest (regardless of auth); Capacitor (native) users skip
          the landing and bounce to /app (authed) or /login (logged-out). */}
      <Route path="/" element={<RootRoute />} />

      {/* Authenticated dashboard lives at /app. Uses the Layout-as-children
          pattern (rather than the nested Outlet form below) because Workouts
          was the canonical home route and we want the splash + chrome to
          behave identically to the pre-refactor "/" experience. */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout>
              <Workouts />
            </Layout>
          </ProtectedRoute>
        }
      />

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
        {/* Apple 3.1.1 — Pro feature, must not be reachable from iOS native
            shell. Web + Android can use it normally. */}
        <Route
          path="/clientworkouts/ai"
          element={Capacitor.getPlatform() === 'ios' ? <Navigate to="/" replace /> : <AIWorkoutGenerator />}
        />
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
        <Route path="/featured-session" element={<FeaturedGate><FeaturedWorkoutSession /></FeaturedGate>} />
        <Route path="/featured-session/:workoutId" element={<FeaturedGate><FeaturedWorkoutSession /></FeaturedGate>} />
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
        <Route path="/test/request-trainer" element={<TestRoute><RequestTrainerTest /></TestRoute>} />
        <Route path="/test/muscle-diagrams" element={<TestRoute><MuscleDiagramsTest /></TestRoute>} />
      </Route>

      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
    </Suspense>
    </VideoPlayerProvider>
    </TutorialProvider>
    </ErrorBoundary>
  );
}
