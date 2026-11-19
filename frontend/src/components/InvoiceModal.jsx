import { useRef } from 'react';
import { Download, Printer, X } from 'lucide-react';
import { formatDate, inr } from '../lib/format';
import { Button } from './ui';

export default function InvoiceModal({ order, open, onClose }) {
  const printRef = useRef(null);

  if (!open || !order) return null;

  const paidAttempt = order.payments?.find((p) => p.status === 'paid');
  const isPaid = order.payment_status === 'paid';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden my-auto border border-sand-300">
        {/* Modal Controls - Hidden during print */}
        <div className="flex items-center justify-between border-b border-sand-200 bg-sand-50/80 px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-900 text-base">Invoice #{order.order_number}</span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isPaid ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-800'}`}>
              {isPaid ? 'PAID' : order.payment_status?.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="size-4" /> Print / Save PDF
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink-800 hover:bg-sand-200/60 transition-colors"
              aria-label="Close invoice"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div ref={printRef} className="p-6 sm:p-10 font-sans text-ink-900 bg-white print:p-0 print:m-0 print:w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-sand-200 pb-8">
            <div>
              <div className="font-serif text-2xl font-bold tracking-tight text-brand-700">
                Sannara
              </div>
              <p className="text-xs text-ink-500 mt-0.5 italic">Authentic Nilgiri Heritage Products</p>
              <p className="text-xs text-ink-600 mt-3 leading-relaxed">
                <strong>Herdsmen Business Ventures Pvt. Ltd.</strong><br />
                10, YBA Building, Church Hill Road,<br />
                Ooty, The Nilgiris, Tamil Nadu – 643001<br />
                Email: hi@ootyoriginals.in · Phone: +91 94876 54990
              </p>
            </div>

            <div className="sm:text-right">
              <span className="inline-block px-3 py-1 bg-brand-50 border border-brand-200 text-brand-800 rounded-md text-xs font-bold tracking-wider uppercase">
                TAX INVOICE
              </span>
              <table className="mt-3 text-xs sm:ml-auto">
                <tbody>
                  <tr>
                    <td className="text-ink-500 pr-3 py-0.5">Invoice / Order No:</td>
                    <td className="font-mono font-bold text-ink-900">{order.order_number}</td>
                  </tr>
                  <tr>
                    <td className="text-ink-500 pr-3 py-0.5">Date:</td>
                    <td className="font-medium">{formatDate(order.created_at, true)}</td>
                  </tr>
                  <tr>
                    <td className="text-ink-500 pr-3 py-0.5">Payment Method:</td>
                    <td className="font-medium">{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment (Razorpay)'}</td>
                  </tr>
                  <tr>
                    <td className="text-ink-500 pr-3 py-0.5">Payment Status:</td>
                    <td className="font-bold text-brand-700">{order.payment_status?.toUpperCase()}</td>
                  </tr>
                  {paidAttempt?.gateway_payment_id && (
                    <tr>
                      <td className="text-ink-500 pr-3 py-0.5">Transaction ID:</td>
                      <td className="font-mono text-[11px] text-ink-700">{paidAttempt.gateway_payment_id}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Billing & Shipping Addresses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-sand-200 text-xs">
            <div>
              <p className="font-bold uppercase tracking-wider text-ink-400 mb-1.5">Billed To</p>
              <p className="font-semibold text-sm text-ink-900">{order.customer_name}</p>
              <p className="text-ink-600 mt-0.5">{order.customer_email}</p>
              <p className="text-ink-600">Phone: {order.ship_phone}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-ink-400 mb-1.5">Shipped / Delivered To</p>
              <p className="font-semibold text-sm text-ink-900">{order.ship_name}</p>
              <p className="text-ink-600 mt-0.5 leading-relaxed">
                {order.ship_line1}{order.ship_line2 ? `, ${order.ship_line2}` : ''}<br />
                {order.ship_city}, {order.ship_state} – {order.ship_pincode}{order.ship_country ? `, ${order.ship_country}` : ''}
              </p>
              <p className="text-ink-600 mt-0.5">Phone: {order.ship_phone}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="py-6 border-b border-sand-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-sand-300 text-ink-500 font-semibold uppercase text-[11px]">
                  <th className="py-2 w-8">#</th>
                  <th className="py-2">Item Description</th>
                  <th className="py-2 text-center w-16">Qty</th>
                  <th className="py-2 text-right w-24">Unit Price</th>
                  <th className="py-2 text-right w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200/70">
                {order.items.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-3 text-ink-400">{idx + 1}</td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink-900">{item.name}</p>
                      {item.variant_label && (
                        <p className="text-[11px] text-ink-500">{item.variant_label}</p>
                      )}
                    </td>
                    <td className="py-3 text-center tabular-nums">{item.quantity}</td>
                    <td className="py-3 text-right tabular-nums">{inr(item.price)}</td>
                    <td className="py-3 text-right font-medium tabular-nums">{inr(item.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-6">
            <div className="text-xs text-ink-500 max-w-xs space-y-1">
              <p className="font-semibold text-ink-800">Terms &amp; Conditions:</p>
              <p className="leading-relaxed">All goods sold are inclusive of applicable GST. Handcrafted and packed fresh from the Nilgiris.</p>
              {order.notes && (
                <p className="pt-2 text-ink-600"><strong className="text-ink-800">Order Note:</strong> {order.notes}</p>
              )}
            </div>

            <div className="w-full sm:w-64 space-y-2 text-xs">
              <div className="flex justify-between text-ink-600">
                <span>Subtotal:</span>
                <span className="font-medium tabular-nums">{inr(order.subtotal)}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-brand-700 font-medium">
                  <span>Discount {order.coupon_code ? `(${order.coupon_code})` : ''}:</span>
                  <span className="tabular-nums">− {inr(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-600">
                <span>Shipping &amp; Delivery:</span>
                <span className="font-medium tabular-nums">{Number(order.shipping_fee) > 0 ? inr(order.shipping_fee) : 'Free'}</span>
              </div>
              <div className="flex justify-between border-t border-sand-300 pt-2 text-sm font-bold text-ink-900">
                <span>Grand Total:</span>
                <span className="text-base text-brand-800 tabular-nums">{inr(order.total)}</span>
              </div>
              <p className="text-[11px] text-right text-ink-400">(Inclusive of all GST)</p>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-10 border-t border-dashed border-sand-300 pt-4 text-center text-xs text-ink-400">
            Thank you for shopping with Sannara! · This is a computer-generated invoice and requires no signature.
          </div>
        </div>
      </div>
    </div>
  );
}
