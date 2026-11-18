import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message, options = {}) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, message, type: options.type || 'success', action: options.action }]);
      setTimeout(() => dismiss(id), options.duration || 4000);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (message, options) => show(message, { ...options, type: 'success' }),
      error: (message, options) => show(message, { ...options, type: 'error', duration: 5500 }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-center gap-3 rounded-2xl bg-ink-900 py-3 pr-2 pl-4 text-sm text-white shadow-lift"
          >
            {t.type === 'error' ? <AlertCircle className="size-5 shrink-0 text-[#ff9f8f]" aria-hidden /> : <CheckCircle2 className="size-5 shrink-0 text-brand-300" aria-hidden />}
            <span className="flex-1 leading-snug">{t.message}</span>
            {t.action && (
              <Link to={t.action.to} onClick={() => dismiss(t.id)} className="shrink-0 rounded-full px-3 py-1.5 font-semibold text-brand-200 hover:bg-white/10">
                {t.action.label}
              </Link>
            )}
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
