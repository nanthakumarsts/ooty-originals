import axios from 'axios';

// Where the API lives. If VITE_API_URL is set, use that (for production).
// Otherwise use relative paths so Vite proxy forwards /api and /uploads to port 5000 (works on localhost, tunnels and LAN).
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const TOKEN_KEY = 'oo_token';

const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Reading data is safe to repeat. A dropped connection, a server restart or a brief "too many
// requests" should never leave a page without its products, so GET calls quietly try again.
const RETRY_AFTER = [600, 1800]; // ms before the 2nd and 3rd attempt
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(error) {
  const request = error.config;
  if (!request || (request.method || 'get').toLowerCase() !== 'get' || error.code === 'ERR_CANCELED') return null;
  const attempt = request.attempt || 0;
  if (attempt >= RETRY_AFTER.length) return null;
  const status = error.response?.status;
  if (status === 429) {
    // the server says how long to wait; only wait if it is short
    const seconds = Number(error.response.headers?.['retry-after']);
    return seconds > 0 && seconds <= 5 ? seconds * 1000 + 200 : null;
  }
  // no answer at all (offline, timeout, server restarting) or a server-side hiccup
  return !error.response || status >= 500 ? RETRY_AFTER[attempt] : null;
}

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const delay = retryDelay(error);
    if (delay !== null) {
      error.config.attempt = (error.config.attempt || 0) + 1;
      await wait(delay);
      return api.request(error.config);
    }
    const status = error.response?.status;
    const data = error.response?.data;
    // An expired or revoked session: tell the app so it can sign the user out cleanly.
    if (status === 401 && localStorage.getItem(TOKEN_KEY) && !error.config.url.startsWith('/auth/login')) {
      window.dispatchEvent(new Event('oo:unauthorized'));
    }
    const err = new Error(
      data?.message || (error.code === 'ERR_NETWORK' ? 'Cannot reach the server. Please check your connection.' : 'Something went wrong. Please try again.')
    );
    err.status = status;
    err.fields = data?.errors || {};
    err.details = data?.details;
    return Promise.reject(err);
  }
);

export default api;
