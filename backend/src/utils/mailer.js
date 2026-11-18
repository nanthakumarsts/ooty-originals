const nodemailer = require('nodemailer');
const config = require('../config/env');
const templates = require('./emailTemplates');

const { smtp } = config;

let transporter = null;
if (smtp.ready) {
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    // never let a slow mail server hold up the request that triggered the email
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

/** Turn a mail-server error into something a shop owner can act on. */
function explain(err) {
  const text = String((err && err.message) || err).slice(0, 300);
  if (err && (err.code === 'EAUTH' || err.responseCode === 535)) {
    return smtp.gmail
      ? 'Gmail did not accept the ID / app password. SMTP_PASS must be a 16-letter App password (Google Account > Security > 2-Step Verification > App passwords), not the normal Gmail password.'
      : `The mail server did not accept SMTP_USER / SMTP_PASS. (${text})`;
  }
  if (err && ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'EDNS'].includes(err.code)) {
    return `Could not reach ${smtp.host}:${smtp.port} — check the internet connection. (${text})`;
  }
  return text;
}

/**
 * Send a templated email. Never throws: a mail problem must not break the request
 * that triggered it. Until SMTP_USER / SMTP_PASS are set the email is only printed to the console.
 */
async function sendMail(template, to, data) {
  const build = templates[template];
  if (!build || !to) return;
  const { subject, html } = build(data);
  try {
    if (transporter) {
      await transporter.sendMail({ from: smtp.from, to, subject, html });
    } else if (!config.isProd) {
      console.log(`[mail:${template}] to ${to} — "${subject}" (not sent: email is not set up in .env)`);
    }
  } catch (err) {
    console.error(`[mail:${template}] failed for ${to}: ${explain(err)}`);
  }
}

/** Sign in to the mail server without sending anything. Resolves to { ok, message }. */
async function checkMail() {
  if (!transporter) return { ok: false, configured: false, message: 'not set up — add SMTP_USER and SMTP_PASS to backend/.env' };
  try {
    await transporter.verify();
    return { ok: true, configured: true, message: `ready — sending as ${smtp.user} via ${smtp.host}` };
  } catch (err) {
    return { ok: false, configured: true, message: explain(err) };
  }
}

/** Send one plain test email (used by `npm run mail:test`). Throws with a readable message. */
async function sendTestMail(to) {
  if (!transporter) throw new Error('Email is not set up yet — add SMTP_USER and SMTP_PASS to backend/.env');
  try {
    const info = await transporter.sendMail({
      from: smtp.from,
      to,
      subject: 'Sannara — test email',
      html: '<p style="font:16px/1.5 Arial,sans-serif;color:#1A3338">It works. Order, payment and account emails from the Sannara store will be sent from this address.</p>',
    });
    return info;
  } catch (err) {
    throw new Error(explain(err));
  }
}

module.exports = { sendMail, checkMail, sendTestMail };
