const app = require('./src/app');
const config = require('./src/config/env');
const { pool } = require('./src/config/db');
const { expireUnpaidOrders } = require('./src/services/orderService');
const { checkMail } = require('./src/utils/mailer');
const { syncConfiguredAdmin } = require('./src/services/configuredAdmin');

async function start() {
  try {
    await pool.query('SELECT 1 FROM settings LIMIT 1');
  } catch (err) {
    console.error('\nCould not read the database.');
    console.error(`  ${err.code || ''} ${err.message}`);
    console.error('  1. Start MySQL from the XAMPP Control Panel');
    console.error('  2. Run:  npm run db:setup\n');
    process.exit(1);
  }

  await syncConfiguredAdmin(config.admin);

  const server = app.listen(config.port, () => {
    console.log(`\nSannara API running on ${config.apiUrl}`);
    console.log(`  Payments: ${config.paymentGateway === 'razorpay' ? 'Razorpay (live keys loaded)' : 'TEST gateway — add Razorpay keys to .env to take real payments'}`);
    if (!config.smtp.ready) console.log('  Email:    not set up — emails are only printed to this console. Add SMTP_USER and SMTP_PASS to .env\n');
    // signs in to the mail server so a wrong ID / app password shows up now, not on the first order
    else checkMail().then((mail) => console[mail.ok ? 'log' : 'error'](`  Email:    ${mail.ok ? '' : 'NOT WORKING — '}${mail.message}\n`));
  });

  // Every 5 minutes: release stock held by online orders that were never paid.
  const tidy = () => expireUnpaidOrders(30).then((n) => n && console.log(`Released ${n} unpaid order(s)`)).catch((err) => console.error('Order tidy-up failed:', err.message));
  tidy();
  setInterval(tidy, 5 * 60 * 1000).unref();

  const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(err => {
  console.error('API startup failed:', err.code || err.name, err.message?.startsWith('ADMIN_EMAIL') ? err.message : '');
  process.exit(1);
});
