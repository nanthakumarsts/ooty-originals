const test = require('node:test');
const assert = require('node:assert/strict');
const { selectItems } = require('../src/services/returnItems');
const order = { subtotal: 400, discount: 40, shipping_fee: 20, total: 380, items: [
  { id: 1, price: 100, quantity: 3 }, { id: 2, price: 100, quantity: 1 }
]};
const a = {order_item_id: 1, quantity: 3};
const b = {order_item_id: 2, quantity: 1};
test('all units of one product receive their net merchandise amount', () => {
  const items = selectItems(order, [a], []);
  assert.deepEqual(items.map(i => [i.order_item_id, i.quantity, i.line_total]), [[1,3,270]]);
});
test('separate return reserves only the requested line', () => {
  const history = [{items: selectItems(order,[b],[]), status:'pending'}];
  assert.equal(selectItems(order,[a],history)[0].line_total,270);
  assert.throws(() => selectItems(order,[b],history));
});
for (const invalid of [null,'{',[],[a,a],[{...a,quantity:4}],[{...a,quantity:0.5}],[{...a,order_item_id:8}]]) {
  test('reject invalid selection '+JSON.stringify(invalid), () => assert.throws(() => selectItems(order,invalid,[])));
}
test('cancelled return releases quantity', () => assert.equal(selectItems(order,[b],[{items:[b],status:'cancelled'}]).length,1));

test('both request types require every unit of a selected line', t => {
  t.after(() => require('../src/config/db').pool.end());
  const { quote } = require('../src/services/cancellationRefund');
  const partial = [{...a, quantity: 1}];
  assert.throws(() => selectItems(order, partial, []), {status: 400});
  assert.throws(() => quote(order, partial), {status: 400});
  assert.equal(quote(order, [a]).amount, 27000);
  assert.equal(quote(order, [a,b]).amount, 38000);
});

test('a historical partial return leaves only the complete remaining balance selectable', () => {
  const history = [{status: 'refunded', items: [{...a, quantity: 1, units: [0]}]}];
  assert.throws(() => selectItems(order, [{...a, quantity: 1}], history), {status: 400});
  assert.deepEqual(selectItems(order, [{...a, quantity: 2}], history)[0].units, [1,2]);
});
