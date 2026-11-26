const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');

test('product reviews from delivery to publication', {skip:process.env.RETURN_SQL_TEST !== '1'}, async t => {
  const conn = await db.pool.getConnection();
  t.after(async () => { conn.destroy(); await db.pool.end(); });
  const tables = ['users','products','orders','order_items','order_status_history','product_reviews'];
  for (const table of tables) await conn.query('CREATE TEMPORARY TABLE review_test_'+table+' LIKE '+table);
  const names = new RegExp('\\b('+tables.join('|')+')\\b','gi');
  const run = async (sql,args=[]) => (await conn.query(sql.replace(names,'review_test_$1'),args))[0];
  t.mock.method(db,'q',run);
  await run(`INSERT INTO users(id,name,email,password_hash,role) VALUES
    (1,'Tea Buyer','buyer@example.invalid','fixture','customer'),
    (2,'Other Buyer','other@example.invalid','fixture','customer'),
    (3,'Moderator','admin@example.invalid','fixture','admin')`);
  await run("INSERT INTO products(id,name,slug,price) VALUES (1,'Tea','tea',10),(2,'Honey','honey',25)");
  await run(`INSERT INTO orders(id,order_number,user_id,status,payment_method,subtotal,total,customer_name,customer_email,
    ship_name,ship_phone,ship_line1,ship_city,ship_state,ship_pincode)
    VALUES(1,'ORDER-1',1,'shipped','cod',10,10,'QA','qa@example.invalid','QA','0','fixture','city','state','000000')`);
  await run("INSERT INTO order_items(order_id,product_id,name,price,quantity) VALUES(1,1,'Tea',10,1)");
  const app = require('../src/app');
  const {signToken} = require('../src/middleware/auth');
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>server.close());
  const call = async (path,method='GET',user,body) => {
    const headers = {'Content-Type':'application/json'};
    if(user) headers.Authorization = 'Bearer '+signToken({id:user,role:user===3?'admin':'customer'});
    const reply = await fetch('http://127.0.0.1:'+server.address().port+'/api'+path,
      {method,headers,body:JSON.stringify(body)});
    return {status:reply.status,data:await reply.json()};
  };
  const tea='/products/1/reviews', honey='/products/2/reviews', admin='/admin/reviews';
  const review={rating:5,feedback:'Fresh tea',status:'published',order_id:99,user_id:2};
  assert.equal((await call(tea,'POST',null,review)).status,401);
  assert.equal((await call(tea,'POST',1,review)).status,403);
  const mine='/account/reviews';
  assert.equal((await call(mine)).status,401);
  assert.deepEqual((await call(mine,'GET',1)).data.items,[]);
  await run("UPDATE orders SET status='delivered' WHERE id=1");
  await run("INSERT INTO order_items(order_id,product_id,name,price,quantity) VALUES(1,1,'Tea',10,2)");
  const available=(await call(mine,'GET',1)).data.items;
  assert.deepEqual(available.map(i=>[i.product_id,i.status]),[[1,null]]);
  assert.deepEqual((await call(mine,'GET',2)).data.items,[]);
  assert.equal((await call(tea,'POST',2,review)).status,403);
  assert.equal((await call(honey,'POST',1,review)).status,403);
  assert.equal((await call(tea,'POST',1,{...review,rating:6})).status,400);
  const submissions=await Promise.all([call(tea,'POST',1,review),call(tea,'POST',1,review)]);
  assert.deepEqual(submissions.map(s=>s.status).sort(),[201,409]);
  assert.deepEqual((await call(tea)).data.items,[]);
  assert.equal((await call(mine,'GET',1)).data.items[0].status,'pending');
  assert.deepEqual((await call(tea,'GET',1)).data,{items:[],hasMore:false});
  assert.equal((await call(admin,'GET',1)).status,403);
  const queue=(await call(admin+'?rating=5&search=ORDER-1','GET',3)).data;
  assert.equal(queue.counts.pending,1);
  assert.equal(queue.items[0].customer,'Tea Buyer');
  const path=admin+'/'+queue.items[0].id;
  const publish={previous:'pending',status:'published'};
  assert.equal((await call(path,'PATCH',1,publish)).status,403);
  assert.equal((await call(path,'PATCH',3,publish)).status,200);
  assert.equal((await call(path,'PATCH',3,{previous:'pending',status:'rejected'})).status,409);
  const [visible]=(await call(tea)).data.items;
  assert.equal(visible.feedback,'Fresh tea');
  assert.equal(visible.author,'Tea');
  assert.deepEqual(Object.keys(visible).sort(),['author','created_at','feedback','id','rating']);
  assert.equal((await call(tea,'GET',2)).data.items.length,1);
  assert.equal((await call(honey)).data.items.length,0);
  assert.equal((await call(path,'PATCH',3,{previous:'published',status:'rejected'})).status,200);
  assert.equal((await call(tea)).data.items.length,0);
  assert.equal((await call(mine,'GET',1)).data.items[0].status,'rejected');
  assert.deepEqual((await call(tea,'GET',1)).data,{items:[],hasMore:false});
});
