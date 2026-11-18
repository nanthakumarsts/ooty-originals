import { API_URL } from './api';

const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });

export const inr = (amount) => rupee.format(Number(amount) || 0);

/** Turn a stored image path (/uploads/…) into a full URL with cache busting. */
export const img = (path) => {
  if (!path) return '/images/placeholder.svg';
  const url = path.startsWith('/uploads') ? `${API_URL}${path}` : path;
  return url.includes('?') ? url : `${url}?v=2`;
};

/** Product and category photos stay centred. */
export const photoFit = () => 'object-center';

export const formatDate = (value, withTime = false) =>
  new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });

export const discountPercent = (price, compare) => (compare && compare > price ? Math.round(((compare - price) / compare) * 100) : 0);

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
  pending: { label: 'Payment pending', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  failed: { label: 'Payment failed', tone: 'red' },
  refunded: { label: 'Refunded', tone: 'gray' },
};

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
