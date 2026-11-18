import axios from 'axios';

// Where the API lives. If VITE_API_URL is not set, use the same computer this page was opened from
// (port 5000) — so the site works both on http://localhost and from a phone via http://192.168.x.x.
export const API_URL = (import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`).replace(/\/$/, '');
export const TOKEN_KEY = 'oo_admin_token';

const api = axios.create({ baseURL: `${API_URL}/api/admin`, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Reading data is safe to repeat: after a dropped connection or a server restart, GET calls try again by themselves.
const RETRY_AFTER = [600, 1800]; // ms before the 2nd and 3rd attempt
function retryDelay(error) {
  const request = error.config;
  if (!request || (request.method || 'get').toLowerCase() !== 'get' || error.code === 'ERR_CANCELED') return null;
  const attempt = request.attempt || 0;
  if (attempt >= RETRY_AFTER.length) return null;
  const status = error.response?.status;
  if (status === 429) {
    const seconds = Number(error.response.headers?.['retry-after']);
    return seconds > 0 && seconds <= 5 ? seconds * 1000 + 200 : null;
  }
  return !error.response || status >= 500 ? RETRY_AFTER[attempt] : null;
}

api.interceptors.response.use(
  (response) => (response.config.responseType === 'blob' ? response : response.data),
  async (error) => {
    const delay = retryDelay(error);
    if (delay !== null) {
      error.config.attempt = (error.config.attempt || 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api.request(error.config);
    }
    const status = error.response?.status;
    const data = error.response?.data;
    if ((status === 401 || status === 403) && localStorage.getItem(TOKEN_KEY) && !error.config.url.startsWith('/auth/login')) {
      window.dispatchEvent(new Event('oo-admin:unauthorized'));
    }
    const err = new Error(data?.message || (error.code === 'ERR_NETWORK' ? 'Cannot reach the server. Is the backend running?' : 'Something went wrong. Please try again.'));
    err.status = status;
    err.fields = data?.errors || {};
    return Promise.reject(err);
  }
);

/** Password reset uses the public auth endpoints, not the /admin ones. */
export const publicApi = axios.create({ baseURL: `${API_URL}/api`, timeout: 20000 });
publicApi.interceptors.response.use(
  (r) => r.data,
  (e) => Promise.reject(Object.assign(new Error(e.response?.data?.message || 'Something went wrong. Please try again.'), { fields: e.response?.data?.errors || {} }))
);

export default api;
