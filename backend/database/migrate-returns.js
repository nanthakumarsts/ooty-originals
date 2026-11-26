const { q } = require('../src/config/db');

async function migrate() {
  console.log('Migrating database for returns, refunds, and cancellations...');

  await q(`
    CREATE TABLE IF NOT EXISTS return_requests (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      reason VARCHAR(100) NOT NULL,
      description TEXT NULL,
      items LONGTEXT NULL,
      attachments LONGTEXT NULL,
      status ENUM(
        'pending',
        'approved',
        'pickup_scheduled',
        'received',
        'refund_processing',
        'refund_initiated',
        'refunded',
        'refund_failed',
        'rejected',
        'cancelled'
      ) NOT NULL DEFAULT 'pending',
      admin_note TEXT NULL,
      refund_amount DECIMAL(10,2) NULL,
      refunded_amount DECIMAL(10,2) NULL,
      refunded_items LONGTEXT NULL,
      razorpay_refund_id VARCHAR(100) NULL,
      shiprocket_return_order_id VARCHAR(100) NULL,
      shiprocket_return_shipment_id VARCHAR(100) NULL,
      reverse_awb_code VARCHAR(100) NULL,
      courier_name VARCHAR(100) NULL,
      idempotency_key VARCHAR(120) NULL,
      pickup_date DATE NULL,
      inspected_at TIMESTAMP NULL,
      refunded_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_return_order (order_id),
      KEY idx_return_user (user_id),
      KEY idx_return_status (status),
      CONSTRAINT fk_return_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_return_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await q(`
      ALTER TABLE orders MODIFY status ENUM(
        'pending',
        'placed',
        'confirmed',
        'processing',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'returned',
        'cancellation_requested'
      ) NOT NULL DEFAULT 'placed'
    `);
  } catch (err) {
    console.log('Orders status enum notice:', err.message);
  }

  console.log('Returns migration successfully completed!');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
