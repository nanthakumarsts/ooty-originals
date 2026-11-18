import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import api, { TOKEN_KEY } from '../lib/api';

/** Admin session + toast notifications. */
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAdmin(null);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setReady(true);
      return;
    }
    api.get('/auth/me').then((d) => setAdmin(d.user)).catch(() => localStorage.removeItem(TOKEN_KEY)).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    window.addEventListener('oo-admin:unauthorized', logout);
    return () => window.removeEventListener('oo-admin:unauthorized', logout);
  }, [logout]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (type, message) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, type, message }]);
      setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      admin,
      ready,
      setAdmin,
      logout,
      login: async (credentials) => {
        const d = await api.post('/auth/login', credentials);
        localStorage.setItem(TOKEN_KEY, d.token);
        setAdmin(d.user);
      },
      toast: { success: (m) => show('success', m), error: (m) => show('error', m) },
    }),
    [admin, ready, logout, show]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex animate-pop items-start gap-3 rounded-xl bg-ink-900 py-3 pr-2 pl-4 text-sm text-white shadow-lift">
            {t.type === 'error' ? <AlertCircle className="mt-0.5 size-[18px] shrink-0 text-[#ff9f8f]" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-brand-300" aria-hidden />}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="flex size-7 shrink-0 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
