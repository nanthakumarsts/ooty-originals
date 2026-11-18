import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { completeTestPayment, failTestPayment } from '../lib/payment';
import { inr } from '../lib/format';
import { Button, Modal } from './ui';

/**
 * Stand-in payment window, shown only when the server has no Razorpay keys.
 * `request` is { order, payment, resolve }; resolve is called with the updated order.
 */
export default function TestPaymentDialog({ request }) {
  const [busy, setBusy] = useState(false);
  if (!request) return null;
  const { order, payment, resolve } = request;

  const finish = async (succeed) => {
    setBusy(true);
    try {
      resolve(await (succeed ? completeTestPayment : failTestPayment)(order, payment));
    } catch {
      resolve({ ...order, payment_status: 'failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title="Test payment">
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e8cf9c] bg-[#fdf6e7] p-4 text-sm leading-relaxed text-[#7a5510]">
        <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>This store is in <strong>test mode</strong>. No real money will be charged. Add Razorpay keys on the server to accept live payments.</p>
      </div>
      <p className="text-ink-500">Amount payable</p>
      <p className="font-display text-4xl font-medium">{inr(order.total)}</p>
      <div className="mt-7 grid gap-3">
        <Button size="lg" onClick={() => finish(true)} loading={busy}>Simulate successful payment</Button>
        <Button variant="outline" onClick={() => finish(false)} disabled={busy}>Simulate failed payment</Button>
      </div>
    </Modal>
  );
}
