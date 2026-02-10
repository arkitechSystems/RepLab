import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StickyHeader from '../components/StickyHeader';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div>
      <StickyHeader title="Profile" />

      <div className="px-4">
        <div className="glass-card rounded-xl p-6 mb-6">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-wf-red/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-wf-red">
                {user?.email?.[0]?.toUpperCase() || 'W'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{user?.email || 'User'}</h2>
              <p className="text-wf-gray-400 text-sm">WillFit Member</p>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4 border-t border-white/10 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-wf-gray-400 text-sm">Email</span>
              <span className="text-white text-sm">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-wf-gray-400 text-sm">Account ID</span>
              <span className="text-wf-gray-500 text-sm">#{user?.id}</span>
            </div>
          </div>
        </div>

        {/* App Info */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <h3 className="text-base font-semibold text-white mb-3">About</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-wf-gray-400 text-sm">App</span>
              <span className="text-white text-sm">WillFit</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-wf-gray-400 text-sm">Version</span>
              <span className="text-wf-gray-500 text-sm">1.0.0 (Demo)</span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full glass-card !border-red-800/50 hover:!border-red-700 text-wf-red font-semibold py-4 rounded-xl text-base transition-all active:scale-[0.98]"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
