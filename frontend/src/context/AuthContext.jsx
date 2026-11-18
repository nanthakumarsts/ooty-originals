import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  // Restore the session on first load.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setReady(true);
      return;
    }
    api
      .get('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    window.addEventListener('oo:unauthorized', signOut);
    return () => window.removeEventListener('oo:unauthorized', signOut);
  }, [signOut]);

  const start = useCallback((data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      login: async (credentials) => start(await api.post('/auth/login', credentials)),
      register: async (details) => start(await api.post('/auth/register', details)),
      logout: signOut,
      setUser,
    }),
    [user, ready, start, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
