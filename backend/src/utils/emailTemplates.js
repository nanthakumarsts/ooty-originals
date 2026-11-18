const config = require('../config/env');

const BG_PAGE = '#0a0f0d';
const BG_CARD = '#131b17';
const BG_INNER = '#1a2420';
const BORDER = '#24342d';
const BRAND_GREEN = '#22c55e';
const BRAND_GOLD = '#eab308';
const TEXT_WHITE = '#f8fafc';
const TEXT_MUTED = '#94a3b8';
const TEXT_LIGHT = '#cbd5e1';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const orderUrl = (o) => `${config.clientUrl}/account/orders/${o.order_number}`;

/**
 * Premium Luxury Email Shell (matching Image 2 / ANR Concierge dark style)
 */
function luxuryLayout({ title, subtitle, badgeText, badgeTone = 'green', orderId, content }) {
  const badgeBg = badgeTone === 'green' ? '#14532d' : badgeTone === 'blue' ? '#1e3a8a' : badgeTone === 'red' ? '#7f1d1d' : '#713f12';
  const badgeColor = badgeTone === 'green' ? '#4ade80' : badgeTone === 'blue' ? '#93c5fd' : badgeTone === 'red' ? '#fca5a5' : '#fde047';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG_PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT_LIGHT};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_PAGE};padding:32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${BG_CARD};border:1px solid ${BORDER};border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
          
          <!-- Top Brand Header -->
          <tr>
            <td align="center" style="padding:28px 24px 20px;background:#0c1410;border-bottom:1px solid ${BORDER};">
              <div style="display:inline-block;padding:4px 12px;background:#16241d;border:1px solid #2a4134;border-radius:8px;">
                <span style="font-family:Georgia,serif;font-size:18px;font-weight:700;letter-spacing:2px;color:${TEXT_WHITE};text-transform:uppercase;">🌿 OOTY ORIGINALS</span>
              </div>
              <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:#789283;margin-top:6px;text-transform:uppercase;">
                HILL CONCIERGE · NILGIRIS
              </div>
            </td>
          </tr>

          <!-- Hero Headline -->
          <tr>
            <td align="center" style="padding:32px 28px 16px;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:${TEXT_WHITE};line-height:1.3;letter-spacing:-0.2px;">
                ${esc(title)}
              </h1>
              ${subtitle ? `<p style="margin:10px 0 0;font-size:13.5px;line-height:1.6;color:${TEXT_MUTED};max-width:440px;">${subtitle}</p>` : ''}
              
              <!-- Badges -->
              <div style="margin-top:18px;">
                ${badgeText ? `<span style="display:inline-block;padding:5px 14px;background-color:${badgeBg};color:${badgeColor};border-radius:99px;font-size:11.5px;font-weight:700;letter-spacing:0.5px;margin-right:8px;">${esc(badgeText)}</span>` : ''}
                ${orderId ? `<span style="display:inline-block;padding:5px 14px;background-color:#1c2822;color:${TEXT_WHITE};border:1px solid #2d4036;border-radius:99px;font-size:11.5px;font-weight:600;">Order ID: ${esc(orderId)}</span>` : ''}
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:10px 24px 28px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px;background-color:#0c1410;border-top:1px solid ${BORDER};font-size:12px;line-height:1.7;color:#64748b;">
              <p style="margin:0;color:#64748b;">© 2026 Ooty Originals · Authentic Nilgiri Mountain Goods. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Render Items Ordered Card */
function itemsSection(items) {
  const rows = items.map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDER};vertical-align:top;">
        <div style="font-weight:600;font-size:14px;color:${TEXT_WHITE};line-height:1.35;">${esc(item.name)}</div>
        ${item.variant_label ? `<div style="font-size:12px;color:#789283;margin-top:3px;">${esc(item.variant_label)}</div>` : ''}
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid ${BORDER};text-align:center;color:${TEXT_MUTED};font-size:13.5px;vertical-align:top;">
        ${item.quantity}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDER};text-align:right;font-weight:600;color:${TEXT_WHITE};font-size:14px;white-space:nowrap;vertical-align:top;">
        ${inr(item.price * item.quantity)}
      </td>
    </tr>
  `).join('');

  return `
    <div style="margin-top:20px;">
      <div style="font-size:12px;font-weight:700;color:#789283;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
        Items Ordered
      </div>
      <div style="background-color:${BG_INNER};border:1px solid ${BORDER};border-radius:14px;padding:6px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <thead>
            <tr>
              <th align="left" style="padding:10px 0 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid ${BORDER};">PRODUCT</th>
              <th align="center" style="padding:10px 10px 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid ${BORDER};">QTY</th>
              <th align="right" style="padding:10px 0 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid ${BORDER};">PRICE</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/** Render Price Breakdown Card */
function priceSection(order) {
  const line = (label, val, highlight = false, isTotal = false) => `
    <tr>
      <td style="padding:${isTotal ? '12px 0 4px' : '6px 0'};color:${isTotal ? TEXT_WHITE : TEXT_MUTED};font-size:${isTotal ? '15px' : '13.5px'};font-weight:${isTotal ? '700' : '500'};">
        ${label}
      </td>
      <td align="right" style="padding:${isTotal ? '12px 0 4px' : '6px 0'};color:${isTotal ? BRAND_GOLD : highlight ? BRAND_GREEN : TEXT_WHITE};font-size:${isTotal ? '17px' : '13.5px'};font-weight:${isTotal ? '700' : '600'};">
        ${val}
      </td>
    </tr>
  `;

  return `
    <div style="margin-top:20px;">
      <div style="font-size:12px;font-weight:700;color:#789283;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
        Price Breakdown
      </div>
      <div style="background-color:${BG_INNER};border:1px solid ${BORDER};border-radius:14px;padding:16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${line('Subtotal', inr(order.subtotal))}
          ${Number(order.discount) > 0 ? line(`Discount${order.coupon_code ? ` (${esc(order.coupon_code)})` : ''}`, '− ' + inr(order.discount), true) : ''}
          ${line('Shipping Charges', Number(order.shipping_fee) > 0 ? inr(order.shipping_fee) : 'Free')}
          <tr><td colspan="2" style="border-top:1px solid ${BORDER};padding-top:4px;"></td></tr>
          ${line('Grand Total', inr(order.total), false, true)}
        </table>
      </div>
    </div>
  `;
}

/** Render Delivery Details Card */
function deliverySection(order) {
  return `
    <div style="margin-top:20px;">
      <div style="font-size:12px;font-weight:700;color:#789283;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
        Delivery Details
      </div>
      <div style="background-color:${BG_INNER};border:1px solid ${BORDER};border-radius:14px;padding:16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#64748b;width:75px;vertical-align:top;">Name</td>
            <td style="padding:4px 0;font-size:13.5px;color:${TEXT_WHITE};font-weight:600;">${esc(order.ship_name || order.customer_name)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#64748b;vertical-align:top;">Phone</td>
            <td style="padding:4px 0;font-size:13.5px;color:${TEXT_WHITE};">${esc(order.ship_phone)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#64748b;vertical-align:top;">Address</td>
            <td style="padding:4px 0;font-size:13.5px;color:${TEXT_LIGHT};line-height:1.5;">
              ${esc(order.ship_line1)}${order.ship_line2 ? ', ' + esc(order.ship_line2) : ''}, ${esc(order.ship_city)}, ${esc(order.ship_state)} – ${esc(order.ship_pincode)}
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

/** Render Payment Details Card */
function paymentSection(order) {
  const isPaid = order.payment_status === 'paid';
  const methodLabel = order.payment_method === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment (Razorpay)';
  const statusColor = isPaid ? '#4ade80' : '#fde047';
  const statusBg = isPaid ? '#14532d' : '#713f12';
  const statusText = isPaid ? 'Paid' : 'Payment Pending';

  return `
    <div style="margin-top:20px;">
      <div style="font-size:12px;font-weight:700;color:#789283;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
        Payment
      </div>
      <div style="background-color:${BG_INNER};border:1px solid ${BORDER};border-radius:14px;padding:16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#64748b;width:75px;">Method</td>
            <td style="padding:4px 0;font-size:13.5px;color:${TEXT_WHITE};font-weight:500;">${methodLabel}</td>
          </tr>
          <tr>
            <td style="padding:6px 0 0;font-size:13px;color:#64748b;">Status</td>
            <td style="padding:6px 0 0;">
              <span style="display:inline-block;padding:3px 10px;background-color:${statusBg};color:${statusColor};border-radius:6px;font-size:11.5px;font-weight:700;">
                ${statusText}
              </span>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

/** Track Button */
function actionButton(label, url) {
  return `
    <div style="margin-top:26px;text-align:center;">
      <a href="${esc(url)}" style="display:inline-block;background-color:#15803d;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 32px;border-radius:10px;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(21,128,61,0.4);">
        ${esc(label)} →
      </a>
    </div>
  `;
}

module.exports = {
  orderConfirmation: ({ order }) => ({
    subject: `Order Confirmed: ${order.order_number}`,
    html: luxuryLayout({
      title: 'Your Order Has Been Confirmed',
      subtitle: `Thank you for your purchase! We have successfully received your order and our Nilgiri team is preparing it for shipment.`,
      badgeText: 'Confirmed',
      badgeTone: 'green',
      orderId: order.order_number,
      content: `
        ${itemsSection(order.items)}
        ${priceSection(order)}
        ${deliverySection(order)}
        ${paymentSection(order)}
        ${actionButton('View & Track Order', orderUrl(order))}
      `,
    }),
  }),

  paymentConfirmation: ({ order, payment }) => ({
    subject: `Payment Received: Order ${order.order_number}`,
    html: luxuryLayout({
      title: 'Payment Received',
      subtitle: `We have received your payment of <strong>${inr(payment.amount)}</strong>. Your order is confirmed and moving to packing.`,
      badgeText: 'Paid',
      badgeTone: 'green',
      orderId: order.order_number,
      content: `
        <div style="background-color:${BG_INNER};border:1px solid ${BORDER};border-radius:14px;padding:16px 18px;margin-top:14px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13.5px;">
            <tr><td style="color:#64748b;padding:4px 0;">Transaction ID</td><td align="right" style="color:${TEXT_WHITE};font-family:monospace;">${esc(payment.gateway_payment_id || '—')}</td></tr>
            <tr><td style="color:#64748b;padding:4px 0;">Gateway</td><td align="right" style="color:${TEXT_WHITE};">${esc(payment.gateway === 'mock' ? 'Test Gateway' : 'Razorpay')}</td></tr>
            <tr><td style="color:#64748b;padding:4px 0;">Amount</td><td align="right" style="color:${BRAND_GOLD};font-weight:700;">${inr(payment.amount)}</td></tr>
          </table>
        </div>
        ${itemsSection(order.items)}
        ${priceSection(order)}
        ${deliverySection(order)}
        ${actionButton('Track Order Status', orderUrl(order))}
      `,
    }),
  }),

  orderStatus: ({ order, note }) => {
    const isShipped = order.status === 'shipped';
    const isDelivered = order.status === 'delivered';
    const tone = isShipped ? 'blue' : isDelivered ? 'green' : 'amber';
    const statusTitle = isShipped ? 'Your Order Has Been Shipped' : isDelivered ? 'Your Order Has Been Delivered' : `Your Order Status: ${order.status.toUpperCase()}`;
    const subtitle = isShipped
      ? 'Your parcel is on its way from the Nilgiri hills! You can follow the live delivery progress below.'
      : isDelivered
      ? 'Your package has been successfully delivered. We hope you enjoy the authentic taste of the hills!'
      : 'We have an update on the progress of your order.';

    return {
      subject: `Order ${order.order_number} Update: ${order.status.toUpperCase()}`,
      html: luxuryLayout({
        title: statusTitle,
        subtitle,
        badgeText: order.status.toUpperCase(),
        badgeTone: tone,
        orderId: order.order_number,
        content: `
          ${order.tracking_number ? `
            <div style="margin-top:16px;background-color:#0f241a;border:1px solid #1e4532;border-radius:14px;padding:16px 18px;text-align:center;">
              <div style="font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">COURIER & TRACKING</div>
              <div style="font-size:17px;font-weight:700;color:${TEXT_WHITE};margin-top:4px;">
                ${order.courier ? `${esc(order.courier)} · ` : ''}${esc(order.tracking_number)}
              </div>
            </div>
          ` : ''}
          ${note ? `
            <div style="margin-top:14px;background-color:${BG_INNER};border:1px solid ${BORDER};border-radius:12px;padding:12px 16px;font-size:13.5px;color:${TEXT_LIGHT};">
              <strong style="color:${TEXT_WHITE};">Note from our team:</strong> ${esc(note)}
            </div>
          ` : ''}
          ${itemsSection(order.items)}
          ${deliverySection(order)}
          ${actionButton('Track Live Shipment', orderUrl(order))}
        `,
      }),
    };
  },

  orderCancelled: ({ order }) => ({
    subject: `Order Cancelled: ${order.order_number}`,
    html: luxuryLayout({
      title: 'Your Order Has Been Cancelled',
      subtitle: `Order <strong>${esc(order.order_number)}</strong> has been cancelled as requested.`,
      badgeText: 'Cancelled',
      badgeTone: 'red',
      orderId: order.order_number,
      content: `
        ${order.payment_status === 'paid' ? `
          <div style="margin-top:16px;background-color:#2a1215;border:1px solid #4c1d24;border-radius:14px;padding:16px 18px;">
            <p style="margin:0;font-size:13.5px;color:#fca5a5;line-height:1.5;">
              Your payment of <strong>${inr(order.total)}</strong> has been scheduled for refund to your original payment method within 5–7 business days.
            </p>
          </div>
        ` : ''}
        ${itemsSection(order.items)}
        ${priceSection(order)}
        ${actionButton('Continue Shopping', config.clientUrl + '/shop')}
      `,
    }),
  }),

  welcome: ({ user }) => ({
    subject: 'Welcome to Ooty Originals',
    html: luxuryLayout({
      title: 'Welcome to Ooty Originals',
      subtitle: 'Your account is now ready. Explore authentic Nilgiri teas, artisanal chocolates, and pure essential oils sourced directly from the hills.',
      badgeText: 'Welcome',
      badgeTone: 'green',
      content: `
        <div style="text-align:center;padding:20px 0;">
          <p style="font-size:14.5px;line-height:1.7;color:${TEXT_LIGHT};margin-bottom:24px;">
            Hi <strong>${esc(user.name)}</strong>,<br>
            Thank you for joining our community of mountain heritage enthusiasts.
          </p>
          ${actionButton('Start Shopping', config.clientUrl + '/shop')}
        </div>
      `,
    }),
  }),

  loginAlert: ({ user, when, ip }) => ({
    subject: 'New sign-in to your Ooty Originals account',
    html: luxuryLayout({
      title: 'New Sign-in Alert',
      subtitle: 'We detected a new sign-in to your account.',
      badgeText: 'Security Notice',
      badgeTone: 'amber',
      content: `
        <div style="background-color:${BG_INNER};border:1px solid ${BORDER};border-radius:14px;padding:16px 18px;margin-top:14px;font-size:13.5px;">
          <p style="margin:0 0 8px;color:${TEXT_WHITE};"><strong>User:</strong> ${esc(user.name)} (${esc(user.email)})</p>
          <p style="margin:0 0 8px;color:${TEXT_MUTED};"><strong>Time:</strong> ${esc(when)}</p>
          <p style="margin:0;color:${TEXT_MUTED};"><strong>IP Address:</strong> ${esc(ip)}</p>
        </div>
        <p style="margin:20px 0 0;font-size:13px;color:${TEXT_MUTED};text-align:center;">
          If this was you, you can safely ignore this email. If not, please change your password immediately.
        </p>
      `,
    }),
  }),

  passwordReset: ({ user, url }) => ({
    subject: 'Reset your Ooty Originals password',
    html: luxuryLayout({
      title: 'Password Reset Request',
      subtitle: 'We received a request to reset the password for your account. This link is valid for 5 minutes.',
      content: `
        <div style="text-align:center;padding:10px 0;">
          ${actionButton('Reset Your Password', url)}
          <p style="margin:24px 0 0;font-size:12.5px;color:#64748b;">
            If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>
      `,
    }),
  }),

  passwordChanged: ({ user }) => ({
    subject: 'Your Ooty Originals password was changed',
    html: luxuryLayout({
      title: 'Password Successfully Updated',
      subtitle: 'The password for your account has been changed.',
      badgeText: 'Updated',
      badgeTone: 'green',
      content: `
        <div style="text-align:center;padding:16px 0;">
          <p style="font-size:13.5px;color:${TEXT_LIGHT};">
            If you did not make this change, please contact our support team immediately.
          </p>
        </div>
      `,
    }),
  }),

  contactReceived: ({ name }) => ({
    subject: 'We received your message · Ooty Originals',
    html: luxuryLayout({
      title: 'Message Received',
      subtitle: 'Thank you for reaching out to us. Our hill concierge team will get back to you within 24 hours.',
      badgeText: 'Received',
      badgeTone: 'green',
      content: `
        <div style="text-align:center;padding:16px 0;">
          <p style="font-size:14px;color:${TEXT_LIGHT};">
            Hi ${esc(name)}, we have received your inquiry and are on it!
          </p>
        </div>
      `,
    }),
  }),

  returnRequested: ({ order, returnReq }) => ({
    subject: `Return Request Received: Order ${order.order_number}`,
    html: luxuryLayout({
      title: 'Return Request Received',
      subtitle: `We have received your return request for Order <strong>${esc(order.order_number)}</strong>. Our team is inspecting your request and proof.`,
      badgeText: 'Return Pending',
      badgeTone: 'amber',
      orderId: order.order_number,
      content: `
        <div style="background-color:${BG_INNER};border:1px solid ${BORDER};border-radius:14px;padding:16px 18px;margin-top:14px;font-size:13.5px;">
          <p style="margin:0 0 8px;color:${TEXT_WHITE};"><strong>Reason:</strong> ${esc(returnReq.reason)}</p>
          ${returnReq.description ? `<p style="margin:0 0 8px;color:${TEXT_LIGHT};"><strong>Details:</strong> ${esc(returnReq.description)}</p>` : ''}
          <p style="margin:0;color:#94a3b8;font-size:12.5px;">
            Our team will review your photos/videos and respond within 24–48 hours. Once approved, reverse pickup and refund will be arranged automatically.
          </p>
        </div>
        ${itemsSection(order.items)}
        ${priceSection(order)}
        ${actionButton('View Order Status', orderUrl(order))}
      `,
    }),
  }),

  returnApproved: ({ order, returnReq, refund }) => ({
    subject: `Return & Refund Approved: Order ${order.order_number}`,
    html: luxuryLayout({
      title: 'Return & Refund Approved',
      subtitle: `Your return request for Order <strong>${esc(order.order_number)}</strong> has been approved!`,
      badgeText: 'Approved & Refunded',
      badgeTone: 'green',
      orderId: order.order_number,
      content: `
        <div style="background-color:#143122;border:1px solid #235d3d;border-radius:14px;padding:18px;margin-top:14px;">
          <h3 style="margin:0 0 6px;color:#4ade80;font-size:15px;font-weight:700;">✓ Refund Initiated: ${inr(order.total)}</h3>
          <p style="margin:0;font-size:13px;color:#cbd5e1;line-height:1.5;">
            ${refund?.refundId ? `Razorpay Refund ID: <strong>${esc(refund.refundId)}</strong><br>` : ''}
            The refund has been dispatched to your original payment method and will reflect in your bank account in 3–5 business days.
          </p>
          ${returnReq.shiprocket_return_order_id ? `
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid #235d3d;font-size:13px;color:#cbd5e1;">
              🚚 <strong>Reverse Courier Pickup:</strong> A pickup has been scheduled at your delivery address. Please keep the product securely packed.
            </div>
          ` : ''}
        </div>
        ${itemsSection(order.items)}
        ${priceSection(order)}
        ${actionButton('Check Order Status', orderUrl(order))}
      `,
    }),
  }),

  returnRejected: ({ order, returnReq, adminNote }) => ({
    subject: `Update on Return Request: Order ${order.order_number}`,
    html: luxuryLayout({
      title: 'Return Request Update',
      subtitle: `We have reviewed your return request for Order <strong>${esc(order.order_number)}</strong>.`,
      badgeText: 'Request Declined',
      badgeTone: 'red',
      orderId: order.order_number,
      content: `
        <div style="background-color:#2a1215;border:1px solid #4c1d24;border-radius:14px;padding:18px;margin-top:14px;">
          <h3 style="margin:0 0 6px;color:#fca5a5;font-size:14.5px;font-weight:700;">Return Request Could Not Be Approved</h3>
          <p style="margin:0;font-size:13px;color:#fecaca;line-height:1.5;">
            ${adminNote ? `<strong>Reason from our concierge:</strong> ${esc(adminNote)}` : 'The submitted proof did not meet our return & refund policy criteria.'}
          </p>
        </div>
        <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
          If you have additional information or questions, reply directly to this email or visit our help &amp; contact page.
        </p>
        ${actionButton('View Order', orderUrl(order))}
      `,
    }),
  }),
};
