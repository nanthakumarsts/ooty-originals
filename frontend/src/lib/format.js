import { API_URL } from './api';

const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });

export const inr = (amount) => rupee.format(Number(amount) || 0);

/** Turn a stored image path (/uploads/…) into a full URL with cache busting. */
export const img = (path) => {
  if (!path) return '/images/placeholder.svg';
  const url = path.startsWith('/uploads') ? `${API_URL}${path}` : path;
  return url.includes('?') ? url : `${url}?v=5`;
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
  pending: { label: 'Pending', tone: 'amber' },
  placed: { label: 'Order placed', tone: 'emerald' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  shipped: { label: 'Shipped', tone: 'violet' },
  out_for_delivery: { label: 'Out for delivery', tone: 'amber' },
  delivered: { label: 'Delivered', tone: 'green' },
  cancellation_requested: { label: 'Cancellation Requested', tone: 'amber' },
  cancelled: { label: 'Cancelled', tone: 'red' },
  returned: { label: 'Returned', tone: 'red' },
  processing: { label: 'Processing', tone: 'blue' },
};

export const PAYMENT_STATUS = {
  pending: { label: 'Payment pending', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  failed: { label: 'Payment failed', tone: 'red' },
  refunded: { label: 'Refunded', tone: 'gray' },
  partially_refunded: { label: 'Partially refunded', tone: 'amber' },
};

export const RETURN_STATUS = {
  pending: { label: 'Under review', tone: 'amber' },
  approved: { label: 'Under review', tone: 'amber' },
  pickup_scheduled: { label: 'Approved · Pickup scheduled', tone: 'violet' },
  received: { label: 'Item under inspection', tone: 'amber' },
  refund_processing: { label: 'Processing refund', tone: 'amber' },
  refund_initiated: { label: 'Refund initiated', tone: 'blue' },
  refunded: { label: 'Refund completed', tone: 'green' },
  refund_failed: { label: 'Refund failed', tone: 'red' },
  rejected: { label: 'Declined', tone: 'red' },
  cancelled: { label: 'Cancelled by customer', tone: 'gray' },
};

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
