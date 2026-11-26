const { HttpError } = require('../middleware/error');

function readItems(value) {
  try {
    const items = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(items) && items.length) return items;
  } catch {}
  throw new HttpError(409, 'Return items are missing or invalid');
}

function selectItems(order, selection, history, { storedRequest = false } = {}) {
  const requested = readItems(selection);
  const seen = new Set();
  const reserved = new Map();
  for (const row of history) {
    if (['rejected','cancelled'].includes(row.status)) continue;
    for (const item of readItems(row.items)) {
      const id = Number(item.order_item_id);
      const slots = reserved.get(id) || new Set();
      if (!order.items.some(line => line.id === id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1)
        throw new HttpError(409, 'Existing return requires review');
      if (item.units) {
        for (const unit of item.units) slots.add(unit);
      } else {
        for (let unit = 0, count = 0; count < item.quantity; unit++) {
          if (!slots.has(unit)) { slots.add(unit); count++; }
        }
      }
      reserved.set(id, slots);
    }
  }
  const cents = value => Math.round(Number(value) * 100);
  const gross = order.items.reduce((sum,i) => sum + cents(i.price) * i.quantity, 0);
  const net = gross - cents(order.discount);
  if (!gross || gross !== cents(order.subtotal) || net < 0 || net + cents(order.shipping_fee) !== cents(order.total))
    throw new HttpError(409, 'Order totals require reconciliation');
  let offset = 0;
  const starts = new Map();
  for (const line of [...order.items].sort((a,b) => a.id-b.id)) {
    starts.set(line.id, offset);
    offset += cents(line.price) * line.quantity;
  }
  // Cumulative integer allocation keeps the final paise stable across separate returns.
  const allocate = value => Number((BigInt(value)*BigInt(net) + BigInt(Math.floor(gross/2))) / BigInt(gross));
  return requested.map(input => {
    const id = Number(input?.order_item_id);
    const qty = input?.quantity;
    const line = order.items.find(i => i.id === id);
    if (!line || seen.has(id) || !Number.isSafeInteger(qty) || qty < 1 || qty > line.quantity)
      throw new HttpError(400, 'Invalid return item or quantity');
    seen.add(id);
    const used = reserved.get(id);
    const available = line.quantity - (used?.size || 0);
    if (qty > available) throw new HttpError(409, 'Requested quantity is already reserved');
    if (!storedRequest && qty !== available)
      throw new HttpError(400, 'Select the full available quantity of each chosen item');
    const units = [];
    let amount = 0;
    for (let unit = 0; unit < line.quantity && units.length < qty; unit++) {
      if (used?.has(unit)) continue;
      units.push(unit);
      const start = starts.get(id) + unit * cents(line.price);
      amount += allocate(start + cents(line.price)) - allocate(start);
    }
    if (units.length !== qty) throw new HttpError(409, 'Requested quantity is already reserved');
    return {
      order_item_id: id, product_id: line.product_id, variant_id: line.variant_id,
      name: line.name, variant_label: line.variant_label, image: line.image, sku: line.sku,
      price: Number(line.price), quantity: qty, units, line_total: amount / 100,
      package_length: line.package_length, package_breadth: line.package_breadth,
      package_height: line.package_height, package_weight: line.package_weight,
    };
  });
}
module.exports = { selectItems, readItems };
