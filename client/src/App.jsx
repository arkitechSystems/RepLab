import { useState } from 'react';
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

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/welcome" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Calendar />} />
        <Route path="/session/:templateId/:date" element={<WorkoutSession />} />
        <Route path="/workouts" element={<Workouts />} />
        <Route path="/workouts/create" element={<CreateWorkout />} />
        <Route path="/programs/create" element={<CreateProgram />} />
        <Route path="/workouts/edit/:id" element={<EditWorkout />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:id" element={<SessionDetail />} />
        <Route path="/utilities" element={<Utilities />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
