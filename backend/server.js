const app = require('./src/app');
const config = require('./src/config/env');
const { pool, q } = require('./src/config/db');
const { expireUnpaidOrders } = require('./src/services/orderService');
const { checkMail } = require('./src/utils/mailer');
const bcrypt = require('bcryptjs');

async function syncAdminCredentials() {
  if (!config.admin?.email || !config.admin?.password) return;
  const adminEmail = config.admin.email.trim().toLowerCase();
  const adminPass = config.admin.password;
  const adminName = config.admin.name || 'Store Admin';

  try {
    const [admin] = await q("SELECT id, email, password_hash FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
    if (!admin) {
      const hash = await bcrypt.hash(adminPass, 11);
      await q("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, '9487654990', ?, 'admin')", [
        adminName, adminEmail, hash,
      ]);
      console.log(`  Admin:    created ${adminEmail} from .env`);
    } else {
      const matches = await bcrypt.compare(adminPass, admin.password_hash);
      const emailChanged = admin.email.toLowerCase() !== adminEmail;
      if (!matches || emailChanged) {
        const newHash = await bcrypt.hash(adminPass, 11);
        await q('UPDATE users SET email = ?, name = ?, password_hash = ? WHERE id = ?', [
          adminEmail, adminName, newHash, admin.id,
        ]);
        console.log(`  Admin:    credentials synced from .env (${adminEmail})`);
      } else {
        console.log(`  Admin:    synced with .env (${adminEmail})`);
      }
    }
  } catch (err) {
    console.error('  Admin:    sync warning:', err.message);
  }
}

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

  // Ensure admin credentials from .env are automatically reflected in the database
  await syncAdminCredentials();

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

start();
