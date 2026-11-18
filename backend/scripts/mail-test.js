// Send one test email to prove the mail settings in .env work.
//   npm run mail:test                 → sends to SMTP_USER itself
//   npm run mail:test -- you@mail.com → sends to that address
const config = require('../src/config/env');
const { sendTestMail } = require('../src/utils/mailer');

const to = process.argv[2] || config.smtp.user;

(async () => {
  if (!to) {
    console.error('\nEmail is not set up yet — add SMTP_USER and SMTP_PASS to backend/.env\n');
    process.exit(1);
  }
  try {
    const info = await sendTestMail(to);
    console.log(`\nSent. Check the inbox of ${to} (and the spam folder the first time).`);
    console.log(`  From: ${config.smtp.from}\n  Mail server said: ${info.response}\n`);
  } catch (err) {
    console.error(`\nThe test email was NOT sent.\n  ${err.message}\n`);
    process.exit(1);
  }
})();
