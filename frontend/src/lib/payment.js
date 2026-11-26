import api from './api';

let scriptPromise = null;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load the payment window. Please check your connection and try again.'));
      };
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

const confirm = (orderNumber, payment, extra = {}) =>
  api.post('/payments/verify', { orderNumber, gatewayOrderId: payment.gatewayOrderId, ...extra });

const reportFailure = (orderNumber, payment, reason) =>
  api.post('/payments/failed', { orderNumber, gatewayOrderId: payment.gatewayOrderId, reason });

/**
 * Opens the Razorpay window for an order and resolves with the updated order —
 * paid when the payment is verified by the server, failed when the shopper closes the window.
 */
export async function payWithRazorpay({ order, payment, user }) {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    let lastError = 'Payment was not completed';
    const checkout = new window.Razorpay({
      key: payment.keyId,
      order_id: payment.gatewayOrderId,
      amount: payment.amount,
      currency: payment.currency,
      name: 'Sannara',
      description: `Order ${order.order_number}`,
      prefill: { name: user.name, email: user.email, contact: user.phone || order.ship_phone },
      theme: { color: '#125F2E' },
      handler: (response) => {
        confirm(order.order_number, payment, { paymentId: response.razorpay_payment_id, signature: response.razorpay_signature })
          .then((d) => resolve(d.order))
          .catch(async (err) => {
            // Fallback check: if the verify request suffered a timeout or network glitch,
            // query the order to see if it was already marked paid by the backend or webhook.
            try {
              const check = await api.get(`/orders/${order.order_number}`);
              if (check?.order?.payment_status === 'paid') {
                return resolve(check.order);
              }
            } catch {}
            reject(err);
          });
      },
      modal: {
        ondismiss: () => {
          reportFailure(order.order_number, payment, lastError)
            .then((d) => resolve(d?.order || { payment_status: 'failed' }))
            .catch(() => resolve({ payment_status: 'failed' }));
        },
      },
    });
    checkout.on('payment.failed', (response) => {
      lastError = response?.error?.description || lastError;
    });
    checkout.open();
  });
}

/** Test gateway used when no Razorpay keys are configured on the server. */
export const completeTestPayment = (order, payment) => confirm(order.order_number, payment).then((d) => d.order);
export const failTestPayment = (order, payment) => reportFailure(order.order_number, payment, 'Test payment declined').then((d) => d.order);
