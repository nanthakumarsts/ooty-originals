import { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';

/**
 * Load something from the API and keep the page honest about it:
 *   data    – the last good answer (kept on screen while a newer one loads)
 *   loading – a request is on its way
 *   error   – why the last request failed ('' when fine)
 *   reload  – ask again (the "Try again" button)
 *
 * After a failure it keeps trying by itself — every few seconds, the moment the connection
 * returns, and when the visitor comes back to the tab — so content appears without a refresh.
 */
export default function useApi(url) {
  const [state, setState] = useState({ data: null, error: '', loading: Boolean(url), url: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    api
      .get(url)
      .then((data) => active && setState({ data, error: '', loading: false, url }))
      .catch((err) => active && setState((s) => ({ ...s, error: err.message, loading: false })));
    return () => { active = false; };
  }, [url, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!state.error) return undefined;
    const again = () => !document.hidden && reload();
    const timer = setTimeout(again, 8000);
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', again);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', again);
      document.removeEventListener('visibilitychange', again);
    };
  }, [state.error, attempt, reload]);

  return { data: state.data, error: state.error, loading: state.loading, reload };
}
