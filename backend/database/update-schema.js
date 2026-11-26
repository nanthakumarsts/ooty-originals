const { q } = require('../src/config/db');

async function migrate() {
  console.log('Running database schema updates...');

  const variantColumns = await q('SHOW COLUMNS FROM product_variants');
  for (const [column,type] of Object.entries({
    sku:'VARCHAR(60)',package_length:'DECIMAL(6,2)',package_breadth:'DECIMAL(6,2)',
    package_height:'DECIMAL(6,2)',package_weight:'DECIMAL(6,3)'
  })) {
    if (!variantColumns.some(c => c.Field === column)) await q('ALTER TABLE product_variants ADD COLUMN '+column+' '+type+' NULL');
  }
  const [orderPayment] = await q("SHOW COLUMNS FROM orders LIKE 'payment_status'");
  if (!orderPayment.Type.includes("'partially_refunded'"))
    await q("ALTER TABLE orders MODIFY payment_status ENUM('pending','paid','failed','refunded','partially_refunded') NOT NULL DEFAULT 'pending'");
  // 1. Update return_requests status enum to include all operational statuses
  await q(`
    ALTER TABLE return_requests 
    MODIFY status ENUM(
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
    ) NOT NULL DEFAULT 'pending'
  `);
  console.log('✓ return_requests status enum updated');

  // 2. Add reverse_awb_code, courier_name, idempotency_key to return_requests if not existing
  const rrCols = await q("SHOW COLUMNS FROM return_requests");
  const rrFieldNames = rrCols.map(c => c.Field);

  if (!rrFieldNames.includes('reverse_awb_code')) {
    await q("ALTER TABLE return_requests ADD COLUMN reverse_awb_code VARCHAR(100) NULL AFTER shiprocket_return_shipment_id");
    console.log('✓ Added reverse_awb_code column');
  }
  if (!rrFieldNames.includes('courier_name')) {
    await q("ALTER TABLE return_requests ADD COLUMN courier_name VARCHAR(100) NULL AFTER reverse_awb_code");
    console.log('✓ Added courier_name column');
  }
  if (!rrFieldNames.includes('idempotency_key')) {
    await q("ALTER TABLE return_requests ADD COLUMN idempotency_key VARCHAR(120) NULL AFTER courier_name");
    console.log('✓ Added idempotency_key column');
  }

  // 3. Add refunded_amount to payments if not existing
  const payCols = await q("SHOW COLUMNS FROM payments");
  const payFieldNames = payCols.map(c => c.Field);

  if (!payFieldNames.includes('refunded_amount')) {
    await q("ALTER TABLE payments ADD COLUMN refunded_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER amount");
    console.log('✓ Added refunded_amount column to payments');
  }

  // 4. Update payments status enum if needed
  try {
    await q("ALTER TABLE payments MODIFY status ENUM('created','paid','failed','refunded','partially_refunded') NOT NULL DEFAULT 'created'");
    console.log('✓ payments status enum updated');
  } catch (err) {
    console.log('Note on payments enum:', err.message);
  }

  console.log('All database schema migrations completed successfully!');
}

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
