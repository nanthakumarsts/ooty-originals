const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { q } = require('../config/db');

// An order counts as a sale once it is paid, or placed as Cash on Delivery, and not cancelled.
const SALE = "o.status <> 'cancelled' AND (o.payment_status = 'paid' OR o.payment_method = 'cod')";
const IN_RANGE = 'o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)';

const cap = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());

/**
 * Report definitions. Each returns { summary: [{ label, value, type }], rows } for the period.
 * Column types: text | int | money | date | datetime. `excelOnly` columns are left out of the
 * PDF, where page width is limited.
 */
const REPORTS = {
  sales: {
    title: 'Sales report',
    description: 'Every order in the period with payment and delivery status.',
    dated: true,
    columns: [
      { key: 'order_number', label: 'Order', type: 'text', width: 13 },
      { key: 'created_at', label: 'Date', type: 'datetime', width: 19 },
      { key: 'customer_name', label: 'Customer', type: 'text', width: 24 },
      { key: 'customer_email', label: 'Email', type: 'text', width: 28, excelOnly: true },
      { key: 'ship_phone', label: 'Phone', type: 'text', width: 14, excelOnly: true },
      { key: 'ship_city', label: 'City', type: 'text', width: 16 },
      { key: 'ship_state', label: 'State', type: 'text', width: 16, excelOnly: true },
      { key: 'items', label: 'Items', type: 'int', width: 8 },
      { key: 'payment', label: 'Payment', type: 'text', width: 11 },
      { key: 'payment_status', label: 'Pay status', type: 'text', width: 12 },
      { key: 'status', label: 'Order status', type: 'text', width: 14 },
      { key: 'coupon_code', label: 'Coupon', type: 'text', width: 12, excelOnly: true },
      { key: 'subtotal', label: 'Subtotal', type: 'money', width: 13, excelOnly: true },
      { key: 'discount', label: 'Discount', type: 'money', width: 12 },
      { key: 'shipping_fee', label: 'Delivery', type: 'money', width: 12, excelOnly: true },
      { key: 'total', label: 'Total', type: 'money', width: 13 },
    ],
    async load(from, to) {
      const rows = await q(
        `SELECT o.order_number, o.created_at, o.customer_name, o.customer_email, o.ship_phone, o.ship_city, o.ship_state,
                (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS items,
                o.payment_method, o.payment_status, o.status, o.coupon_code, o.subtotal, o.discount, o.shipping_fee, o.total,
                (${SALE}) AS is_sale
           FROM orders o WHERE ${IN_RANGE} ORDER BY o.id`,
        [from, to]
      );
      const sales = rows.filter((r) => r.is_sale);
      const revenue = sales.reduce((sum, r) => sum + Number(r.total), 0);
      return {
        rows: rows.map((r) => ({ ...r, items: Number(r.items), payment: r.payment_method === 'cod' ? 'COD' : 'Online', payment_status: cap(r.payment_status), status: cap(r.status), coupon_code: r.coupon_code || '' })),
        summary: [
          { label: 'Orders placed', value: rows.length, type: 'int' },
          { label: 'Completed sales', value: sales.length, type: 'int' },
          { label: 'Revenue', value: revenue, type: 'money' },
          { label: 'Average order value', value: sales.length ? revenue / sales.length : 0, type: 'money' },
          { label: 'Discounts given', value: sales.reduce((sum, r) => sum + Number(r.discount), 0), type: 'money' },
          { label: 'Cancelled orders', value: rows.filter((r) => r.status === 'cancelled').length, type: 'int' },
        ],
      };
    },
  },

  products: {
    title: 'Product sales report',
    description: 'Units sold and revenue for each product in the period.',
    dated: true,
    columns: [
      { key: 'name', label: 'Product', type: 'text', width: 40 },
      { key: 'variant', label: 'Option', type: 'text', width: 18 },
      { key: 'orders', label: 'Orders', type: 'int', width: 10 },
      { key: 'units', label: 'Units sold', type: 'int', width: 12 },
      { key: 'revenue', label: 'Revenue', type: 'money', width: 15 },
    ],
    async load(from, to) {
      const rows = await q(
        `SELECT oi.name, COALESCE(oi.variant_label, '') AS variant, COUNT(DISTINCT oi.order_id) AS orders,
                SUM(oi.quantity) AS units, SUM(oi.price * oi.quantity) AS revenue
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE ${IN_RANGE} AND ${SALE}
          GROUP BY oi.name, variant ORDER BY units DESC, revenue DESC`,
        [from, to]
      );
      const clean = rows.map((r) => ({ ...r, orders: Number(r.orders), units: Number(r.units), revenue: Number(r.revenue) }));
      return {
        rows: clean,
        summary: [
          { label: 'Products sold', value: new Set(clean.map((r) => r.name)).size, type: 'int' },
          { label: 'Units sold', value: clean.reduce((sum, r) => sum + r.units, 0), type: 'int' },
          { label: 'Revenue', value: clean.reduce((sum, r) => sum + r.revenue, 0), type: 'money' },
        ],
      };
    },
  },

  stock: {
    title: 'Stock report',
    description: 'Current stock and price of every product and option.',
    dated: false,
    columns: [
      { key: 'name', label: 'Product', type: 'text', width: 38 },
      { key: 'category', label: 'Category', type: 'text', width: 22 },
      { key: 'option_label', label: 'Option', type: 'text', width: 18 },
      { key: 'price', label: 'Price', type: 'money', width: 12 },
      { key: 'stock', label: 'In stock', type: 'int', width: 10 },
      { key: 'stock_status', label: 'Status', type: 'text', width: 14 },
      { key: 'visible', label: 'Visible', type: 'text', width: 9 },
    ],
    async load() {
      const rows = await q(
        `SELECT p.name, COALESCE(c.name, '') AS category, COALESCE(v.label, '') AS option_label,
                COALESCE(v.price, p.price) AS price, COALESCE(v.stock, p.stock) AS stock, p.is_active
           FROM products p
           LEFT JOIN categories c ON c.id = p.category_id
           LEFT JOIN product_variants v ON v.product_id = p.id
          ORDER BY p.name, v.sort_order, v.id`
      );
      const clean = rows.map((r) => ({
        ...r,
        price: Number(r.price),
        stock: Number(r.stock),
        stock_status: r.stock <= 0 ? 'Out of stock' : r.stock <= 5 ? 'Low stock' : 'In stock',
        visible: r.is_active ? 'Yes' : 'No',
      }));
      return {
        rows: clean,
        summary: [
          { label: 'Stock lines', value: clean.length, type: 'int' },
          { label: 'Out of stock', value: clean.filter((r) => r.stock <= 0).length, type: 'int' },
          { label: 'Low stock (1–5)', value: clean.filter((r) => r.stock > 0 && r.stock <= 5).length, type: 'int' },
          { label: 'Units in stock', value: clean.reduce((sum, r) => sum + Math.max(0, r.stock), 0), type: 'int' },
          { label: 'Stock value at selling price', value: clean.reduce((sum, r) => sum + Math.max(0, r.stock) * r.price, 0), type: 'money' },
        ],
      };
    },
  },

  customers: {
    title: 'Customer report',
    description: 'All customers, with their orders and spend in the period.',
    dated: true,
    columns: [
      { key: 'name', label: 'Customer', type: 'text', width: 26 },
      { key: 'email', label: 'Email', type: 'text', width: 32 },
      { key: 'phone', label: 'Phone', type: 'text', width: 14 },
      { key: 'created_at', label: 'Joined', type: 'date', width: 14 },
      { key: 'account', label: 'Account', type: 'text', width: 10 },
      { key: 'orders', label: 'Orders', type: 'int', width: 9 },
      { key: 'spent', label: 'Spent', type: 'money', width: 14 },
    ],
    async load(from, to) {
      const rows = await q(
        `SELECT u.name, u.email, COALESCE(u.phone, '') AS phone, u.created_at, u.status,
                (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND ${IN_RANGE}) AS orders,
                (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.user_id = u.id AND ${IN_RANGE} AND ${SALE}) AS spent,
                (u.created_at >= ? AND u.created_at < DATE_ADD(?, INTERVAL 1 DAY)) AS is_new
           FROM users u WHERE u.role = 'customer' ORDER BY spent DESC, u.name`,
        [from, to, from, to, from, to]
      );
      const clean = rows.map((r) => ({ ...r, orders: Number(r.orders), spent: Number(r.spent), account: cap(r.status) }));
      return {
        rows: clean,
        summary: [
          { label: 'Customers', value: clean.length, type: 'int' },
          { label: 'New in this period', value: clean.filter((r) => r.is_new).length, type: 'int' },
          { label: 'Customers who ordered', value: clean.filter((r) => r.orders > 0).length, type: 'int' },
          { label: 'Total spent', value: clean.reduce((sum, r) => sum + r.spent, 0), type: 'money' },
        ],
      };
    },
  },
};

const pad = (n) => String(n).padStart(2, '0');
const toDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const niceDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Validates the requested period, defaulting to the last 30 days. */
function resolvePeriod(from, to) {
  const valid = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(today.getDate() - 29);
  let start = valid(from) ? from : toDay(monthAgo);
  let end = valid(to) ? to : toDay(today);
  if (start > end) [start, end] = [end, start];
  return { from: start, to: end };
}

async function buildReport(type, from, to) {
  const def = REPORTS[type];
  if (!def) return null;
  const period = resolvePeriod(from, to);
  const { rows, summary } = await def.load(period.from, period.to);
  return {
    type,
    title: def.title,
    description: def.description,
    dated: def.dated,
    period: def.dated ? period : null,
    periodLabel: def.dated ? `${niceDay(period.from)} to ${niceDay(period.to)}` : `As of ${niceDay(toDay(new Date()))}`,
    generatedAt: new Date(),
    columns: def.columns,
    summary,
    rows,
  };
}

const listReports = () => Object.entries(REPORTS).map(([type, r]) => ({ type, title: r.title, description: r.description, dated: r.dated }));

// ---------------------------------------------------------------- Excel

const GREEN = 'FF125F2E';

async function toExcel(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ooty Originals';
  workbook.created = report.generatedAt;
  const sheet = workbook.addWorksheet(report.title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 0 }] });
  const lastColumn = report.columns.length;

  sheet.mergeCells(1, 1, 1, lastColumn);
  Object.assign(sheet.getCell(1, 1), { value: `Ooty Originals — ${report.title}` });
  sheet.getCell(1, 1).font = { size: 16, bold: true, color: { argb: GREEN } };
  sheet.getRow(1).height = 26;
  sheet.mergeCells(2, 1, 2, lastColumn);
  sheet.getCell(2, 1).value = `${report.periodLabel}   ·   Generated ${report.generatedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`;
  sheet.getCell(2, 1).font = { color: { argb: 'FF5A6B6F' } };

  let rowIndex = 4;
  for (const item of report.summary) {
    sheet.getCell(rowIndex, 1).value = item.label;
    sheet.getCell(rowIndex, 1).font = { color: { argb: 'FF5A6B6F' } };
    const cell = sheet.getCell(rowIndex, 2);
    cell.value = Number(item.value);
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'left' };
    cell.numFmt = item.type === 'money' ? '"₹"#,##0.00' : '#,##0';
    rowIndex++;
  }

  const headerRow = rowIndex + 1;
  report.columns.forEach((column, i) => {
    sheet.getColumn(i + 1).width = column.width;
    const cell = sheet.getCell(headerRow, i + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    cell.alignment = { vertical: 'middle', horizontal: column.type === 'money' || column.type === 'int' ? 'right' : 'left' };
  });
  sheet.getRow(headerRow).height = 22;

  report.rows.forEach((row, r) => {
    report.columns.forEach((column, i) => {
      const cell = sheet.getCell(headerRow + 1 + r, i + 1);
      const value = row[column.key];
      if (column.type === 'money') { cell.value = Number(value) || 0; cell.numFmt = '"₹"#,##0.00'; }
      else if (column.type === 'int') { cell.value = Number(value) || 0; cell.numFmt = '#,##0'; }
      else if (column.type === 'date' || column.type === 'datetime') { cell.value = value ? new Date(value) : null; cell.numFmt = column.type === 'date' ? 'dd mmm yyyy' : 'dd mmm yyyy, hh:mm'; cell.alignment = { horizontal: 'left' }; }
      else cell.value = value == null ? '' : String(value);
    });
  });

  // Freeze everything above the data and add filter arrows to the header row.
  sheet.views = [{ state: 'frozen', ySplit: headerRow }];
  sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: lastColumn } };
  return workbook.xlsx.writeBuffer();
}

// ---------------------------------------------------------------- PDF

// The built-in PDF fonts have no rupee sign, so amounts are written as "Rs 1,080".
const pdfValue = (value, type) => {
  if (type === 'money') return 'Rs ' + (Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (type === 'int') return (Number(value) || 0).toLocaleString('en-IN');
  if (type === 'date') return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  if (type === 'datetime') return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  // keep to characters the built-in font can draw
  return String(value ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/₹/g, 'Rs ').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
};

function toPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true, info: { Title: `Ooty Originals - ${report.title}`, Author: 'Ooty Originals' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = doc.page.height - doc.page.margins.bottom - 16;
    const columns = report.columns.filter((c) => !c.excelOnly);
    const weight = columns.reduce((sum, c) => sum + c.width, 0);
    const widths = columns.map((c) => (c.width / weight) * width);
    const rowHeight = 20;
    const numeric = (c) => c.type === 'money' || c.type === 'int';

    // Title block
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#125F2E').text('Ooty Originals', left, 34);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1A3338').text(report.title, left, 58);
    doc.font('Helvetica').fontSize(9.5).fillColor('#5A6B6F').text(`${pdfValue(report.periodLabel)}   |   Generated ${report.generatedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, left, 76);

    // Summary tiles
    const perRow = Math.min(report.summary.length, 6);
    const gap = 8;
    const tileWidth = (width - gap * (perRow - 1)) / perRow;
    let y = 98;
    report.summary.forEach((item, i) => {
      const x = left + (i % perRow) * (tileWidth + gap);
      const tileY = y + Math.floor(i / perRow) * 50;
      doc.roundedRect(x, tileY, tileWidth, 42, 5).fillAndStroke('#F6F5F1', '#E7E3D9');
      doc.font('Helvetica').fontSize(8).fillColor('#5A6B6F').text(item.label, x + 8, tileY + 7, { width: tileWidth - 16, lineBreak: false, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(12.5).fillColor('#1A3338').text(pdfValue(item.value, item.type), x + 8, tileY + 21, { width: tileWidth - 16, lineBreak: false, ellipsis: true });
    });
    y += Math.ceil(report.summary.length / perRow) * 50 + 8;

    const drawHeader = () => {
      doc.rect(left, y, width, rowHeight + 2).fill('#125F2E');
      let x = left;
      columns.forEach((column, i) => {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF').text(column.label, x + 5, y + 7, { width: widths[i] - 10, align: numeric(column) ? 'right' : 'left', lineBreak: false, ellipsis: true });
        x += widths[i];
      });
      y += rowHeight + 2;
    };

    drawHeader();
    if (!report.rows.length) {
      doc.font('Helvetica').fontSize(10).fillColor('#5A6B6F').text('No records for this period.', left, y + 14, { width, align: 'center' });
    }
    report.rows.forEach((row, r) => {
      if (y + rowHeight > bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
      }
      if (r % 2 === 1) doc.rect(left, y, width, rowHeight).fill('#FAF8F3');
      let x = left;
      columns.forEach((column, i) => {
        doc.font('Helvetica').fontSize(8.5).fillColor('#1A3338').text(pdfValue(row[column.key], column.type), x + 5, y + 6, { width: widths[i] - 10, align: numeric(column) ? 'right' : 'left', lineBreak: false, ellipsis: true });
        x += widths[i];
      });
      doc.moveTo(left, y + rowHeight).lineTo(left + width, y + rowHeight).lineWidth(0.5).strokeColor('#E7E3D9').stroke();
      y += rowHeight;
    });

    // Page numbers
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.font('Helvetica').fontSize(8).fillColor('#7E8C8F').text(`Page ${i + 1} of ${range.count}`, left, doc.page.height - doc.page.margins.bottom - 4, { width, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

module.exports = { buildReport, listReports, toExcel, toPdf };
