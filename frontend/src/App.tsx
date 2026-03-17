import { useAuth } from './hooks/useAuth';
import AuthScreen from './components/AuthScreen';
import EmailDashboard from './components/EmailDashboard';

export default function App() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLogin={login} />;
  }

  return <EmailDashboard user={user} onLogout={logout} />;
}
