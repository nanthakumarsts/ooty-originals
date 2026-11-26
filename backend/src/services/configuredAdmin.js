const bcrypt = require('bcryptjs');
const { tx } = require('../config/db');

async function syncConfiguredAdmin({ email, password, name }) {
  if (!email || !password) return;
  const address = email.trim().toLowerCase();
  const displayName = name?.trim() || 'Store Admin';
  await tx(async run => {
    const [owner] = await run('SELECT id, role, name, email, password_hash FROM users WHERE email = ? FOR UPDATE', [address]);
    if (owner && owner.role !== 'admin') throw new Error('ADMIN_EMAIL is already used by a customer account');
    let admin = owner;
    if (!admin) {
      const admins = await run("SELECT id, name, email, password_hash FROM users WHERE role = 'admin' ORDER BY id LIMIT 2 FOR UPDATE");
      if (admins.length > 1) throw new Error('ADMIN_EMAIL must identify an administrator when multiple admin accounts exist');
      admin = admins[0];
    }
    if (!admin) {
      const hash = await bcrypt.hash(password, 11);
      await run("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, '9487654990', ?, 'admin')",
        [displayName, address, hash]);
      return;
    }
    const passwordMatches = await bcrypt.compare(password, admin.password_hash);
    if (passwordMatches && admin.email === address && admin.name === displayName) return;
    const hash = passwordMatches ? admin.password_hash : await bcrypt.hash(password, 11);
    await run("UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ? AND role = 'admin'",
      [displayName, address, hash, admin.id]);
  });
}

module.exports = { syncConfiguredAdmin };
