import { useState, type ReactNode } from 'react';

const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD;
const STORAGE_KEY = 'demo_authenticated';

interface DemoGateProps {
  children: ReactNode;
}

export default function DemoGate({ children }: DemoGateProps) {
  const [authenticated, setAuthenticated] = useState(
    () => !DEMO_PASSWORD || sessionStorage.getItem(STORAGE_KEY) === 'true',
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (authenticated) {
    return <>{children}</>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === DEMO_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setAuthenticated(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 w-full max-w-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Inbox Concierge</h1>
            <p className="text-xs text-slate-400">Enter the demo password to continue</p>
          </div>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          placeholder="Password"
          autoFocus
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
        />
        {error && (
          <p className="text-xs text-red-500 mb-3">Incorrect password. Please try again.</p>
        )}
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors cursor-pointer text-sm"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
