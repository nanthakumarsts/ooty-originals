import { API_URL } from './api';

const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export const inr = (amount) => rupee.format(Number(amount) || 0);
export const inrCompact = (amount) => '₹' + compact.format(Number(amount) || 0);

export const img = (path) => {
  if (!path) return '/images/placeholder.svg';
  const url = path.startsWith('/uploads') ? `${API_URL}${path}` : path;
  return url.includes('?') ? url : `${url}?v=2`;
};

export const formatDate = (value, withTime = false) =>
  value
    ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) })
    : '—';

export const ORDER_STATUS = {
  pending: { label: 'Awaiting payment', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  processing: { label: 'Packing', tone: 'blue' },
  shipped: { label: 'Shipped', tone: 'violet' },
  delivered: { label: 'Delivered', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
  returned: { label: 'Returned', tone: 'red' },
};

export const PAYMENT_STATUS = {
  pending: { label: 'Pending', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  refunded: { label: 'Refunded', tone: 'gray' },
};
