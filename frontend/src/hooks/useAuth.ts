import { useCallback, useEffect, useState } from 'react';
import { getLoginUrl, getMe } from '../api/auth';
import type { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      window.history.replaceState({}, '', '/');
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    getMe()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async () => {
    const url = await getLoginUrl();
    window.location.href = url;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
