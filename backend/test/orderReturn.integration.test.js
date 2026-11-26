// Opt-in: copies table definitions only. Every application query uses connection-local fixtures.
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/config/env');
const db = require('../src/config/db');
const tables = ['orders','order_items','order_status_history','return_requests','payments','products',
  'product_variants','addresses','product_images','coupons','settings'];
const tableNames = new RegExp('\\b('+tables.join('|')+')\\b','gi');
const response = () => ({status(){return this;},json(body){this.body=body;}});
test('temporary SQL order and return lifecycle', {skip:process.env.RETURN_SQL_TEST !== '1'}, async t => {
  const conn = await db.pool.getConnection();
  t.after(async () => { conn.destroy(); await db.pool.end(); });
  for (const table of tables) await conn.query('CREATE TEMPORARY TABLE qa_'+table+' LIKE '+table);
  const run = async(sql,args=[]) => (await conn.query(sql.replace(tableNames,'qa_$1'),args))[0];
  t.mock.method(db,'q',run);
  t.mock.method(db,'tx',async fn => {
    await conn.beginTransaction();
    try {const result=await fn(run); await conn.commit(); return result;}
    catch(e){await conn.rollback(); throw e;}
  });
  const mail = require('../src/utils/mailer');
  const sentMail=[];
  t.mock.method(mail,'sendMail',async(type)=>{sentMail.push(type);});
  const sendLocal = global.fetch;
  t.mock.method(global,'fetch',async()=>{throw new Error('Unexpected external call');});
  config.paymentGateway='razorpay';
  config.razorpay={keyId:'fixture',keySecret:'fixture'};
  config.shiprocket={email:'qa@example.invalid',password:'fixture',pickupLocation:'fixture'};
  const shipping=require('../src/services/shiprocketService');
  t.mock.method(shipping,'getLiveShippingRate',async()=>({available:true,rate:20}));
  const orderApi=require('../src/controllers/orderController');
  const returns=require('../src/controllers/returnController');
  const orderService=require('../src/services/orderService');
  const paymentApi=require('../src/controllers/paymentController');
  const user={id:1,name:'QA',email:'qa@example.invalid',phone:'0000000000'};
  const traffic=[];
  let captured=true, reverseFails=false, awbConfirmed=true, pickupConfirmed=true, refundState='processed', refundCalls=0;
  global.fetch.mock.mockImplementation(async(url,opts) => {
    const body=JSON.parse(opts.body || '{}');
    traffic.push({url,body,headers:opts.headers});
    let reply;
    if(url.endsWith('/v1/orders')) reply={id:'order_fixture'};
    else if(url.endsWith('/v1/payments/pay_fixture')) reply={id:'pay_fixture',captured,order_id:'order_fixture',amount:(await run('SELECT amount FROM payments'))[0].amount*100,currency:'INR'};
    else if(url.endsWith('/auth/login')) reply={token:'fixture'};
    else if(url.endsWith('/create/adhoc')) reply={order_id:100,shipment_id:200};
    else if(url.endsWith('/settings/company/pickup')) reply={data:{shipping_address:[{pickup_location:'fixture',address:'QA',pin_code:'641104',city:'Ooty',state:'TN',country:'India',phone:'0000000000'}]}};
    else if(url.includes('/courier/serviceability/')) reply={data:{available_courier_companies:[
      {blocked:0,courier_name:'Heavy',courier_company_id:138,rate:343.52,whatsapp_charges:5},
      {blocked:1,courier_name:'Unavailable',courier_company_id:9,rate:1},
      {blocked:'0',courier_name:'Surface',courier_company_id:61,rate:110.41,whatsapp_charges:5},
    ]}};
    else if(url.endsWith('/orders/show/101')) reply={data:{status:reverseCancelled?'CANCELED':'RETURN PENDING',shipments:{id:201,awb:null}}};
    else if(url.endsWith('/orders/cancel')) {reverseCancelled=true;reply={success:true};}
    else if(url.endsWith('/courier/assign/awb')) reply=awbConfirmed ? {response:{data:{awb_code:'QA-AWB'}}} : {message:'AWB pending'};
    else if(url.endsWith('/courier/generate/pickup')) reply=pickupConfirmed ? {pickup_status:1,response:{pickup_scheduled_date:'2027-01-04 10:00:00'}} : {pickup_status:0};
    else if(url.endsWith('/create/return')) {
      if(reverseFails) throw new Error('fixture carrier failure');
      reply={order_id:101,shipment_id:201};
    } else if(url.endsWith('/refund')) {
      refundCalls++;
      if(refundState==='error') return {ok:false,json:async()=>({error:{description:'fixture error'}})};
      reply={id:'rfnd_fixture',payment_id:'pay_fixture',amount:body.amount,status:refundState};
    } else throw new Error('Unexpected mock URL');
    return {ok:true,json:async()=>reply};
  });
  await run("INSERT INTO products(id,name,slug,price,stock) VALUES (1,'A','a',100,10),(2,'B','b',200,10)");
  await run("INSERT INTO addresses(user_id,full_name,phone,line1,city,state,pincode) VALUES (1,'QA','0000000000','Fixture','Ooty','TN','643001')");
  const placed=response();
  await orderApi.place({user,body:{items:[{productId:1,quantity:3},{productId:2,quantity:1}],paymentMethod:'online',addressId:1}},placed);
  const order=placed.body.order;
  const state=async()=>orderService.getOrder('id=?',[order.id]);
  const req=(line,quantity=line.quantity)=>({params:{orderNumber:order.order_number},user,body:{reason:'Fixture return',items:[{order_item_id:line.id,quantity}]}});
  const admin={params:{id:order.id},body:{pickupDate:'2027-01-02'}};
  const setStatus=async(status)=>run('UPDATE return_requests SET status=? WHERE order_id=?',[status,order.id]);
  await t.test('checkout stores two lines, charges actual total in paise',async()=>{
    assert.deepEqual(order.items.map(i=>[i.order_id,i.product_id,i.quantity,i.price]),[[order.id,1,3,100],[order.id,2,1,200]]);
    assert.equal(traffic.find(r=>r.url.endsWith('/v1/orders')).body.amount,52000);
    assert.equal(order.ship_pincode,'643001');
  });
  await t.test('a subset cannot silently cancel an entire unpaid checkout',async()=>{
    await assert.rejects(orderApi.cancel({user,params:{orderNumber:order.order_number},
      body:{items:[{orderItemId:order.items[0].id,quantity:3}]}},response()),{status:400});
    assert.equal((await state()).status,'pending');
  });
  const signature=require('node:crypto').createHmac('sha256','fixture').update('order_fixture|pay_fixture').digest('hex');
  await t.test('uncaptured payment and late failure preserve order and stock',async()=>{
    captured=false;
    await assert.rejects(paymentApi.verify({user,body:{orderNumber:order.order_number,gatewayOrderId:'order_fixture',paymentId:'pay_fixture',signature}},response()),{status:409});
    await paymentApi.failed({user,body:{orderNumber:order.order_number,gatewayOrderId:'order_fixture',reason:'Fixture'}},response());
    assert.equal((await state()).items.length,2);
    assert.equal((await run('SELECT stock FROM products WHERE id=1'))[0].stock,7);
    captured=true;
  });
  await paymentApi.verify({user,body:{orderNumber:order.order_number,gatewayOrderId:'order_fixture',paymentId:'pay_fixture',signature}},response());
  // Wait for the controller's asynchronous forward-shipment write.
  for(let i=0;i<50 && !(await state()).shiprocket_shipment_id;i++) await new Promise(resolve=>setTimeout(resolve,5));
  await t.test('forward payload, payment and shipment reference match order',async()=>{
    const payload=traffic.find(r=>r.url.endsWith('/create/adhoc')).body;
    assert.deepEqual(payload.order_items.map(i=>[i.name,i.units,i.selling_price]),[['A',3,100],['B',1,200]]);
    assert.equal(payload.shipping_pincode,'643001');
    assert.equal((await state()).shiprocket_shipment_id,'200');
    assert.equal((await state()).payments[0].gateway_payment_id,'pay_fixture');
  });
  await t.test('undelivered order rejected',async()=>assert.rejects(returns.requestReturn(req(order.items[0]),response())));
  await run("UPDATE orders SET status='delivered' WHERE id=?",[order.id]);
  await orderService.addHistory(run,order.id,'delivered','Fixture delivery');
  await t.test('other customer rejected',async()=>assert.rejects(returns.requestReturn({...req(order.items[0]),user:{id:2}},response()),{status:403}));
  await t.test('reject one unit from a three-unit product', async () => {
    await assert.rejects(returns.requestReturn(req(order.items[0],1),response()), {status:400});
    assert.equal((await run('SELECT id FROM return_requests')).length,0);
  });
  const ret=response();
  await returns.requestReturn(req(order.items[0]),ret);
  await t.test('All three units of A requested, B and forward shipment remain intact',async()=>{
    assert.deepEqual(ret.body.returnRequest.items.map(i=>[i.order_item_id,i.quantity]),[[order.items[0].id,3]]);
    assert.equal(ret.body.returnRequest.reason,'Fixture return');
    assert.equal((await state()).items[1].quantity,1);
    assert.equal((await state()).status,'delivered');
    assert.equal((await state()).shiprocket_shipment_id,'200');
  });
  await t.test('same-order B can be returned separately while A is pending',async()=>{
    const result=response(); await returns.requestReturn(req(order.items[1]),result);
    assert.equal(result.body.returnRequest.items[0].order_item_id,order.items[1].id);
    await run('DELETE FROM return_requests WHERE id=?',[result.body.returnRequest.id]);
  });
  await t.test('refund settlement reserves pending money and credits a repeated processed event once',async t=>{
    const refunds=require('../src/services/returnRefund');
    const id=ret.body.returnRequest.id;
    await run("UPDATE return_requests SET status='received' WHERE id=?",[id]);
    const balance=async()=> (await run('SELECT refunded_amount FROM payments'))[0].refunded_amount;
    const stock=async()=> (await run('SELECT stock FROM products WHERE id=1'))[0].stock;
    const original=await stock();
    let event;
    t.mock.method(orderService,'refundPayment',async(paymentId,amount,notes)=>{
      event={refundId:'rfnd_qa_partial',amount,paymentId,key:notes.idempotencyKey,status:'pending'};
      return event;
    });
    try {
      assert.equal(await refunds.processReturn(order.id,id),'refund_initiated');
      assert.equal(await balance(),0);
      assert.equal(await stock(),original);
      const processed={...event,status:'processed'};
      await assert.rejects(refunds.settle(order.id,id,{...processed,amount:101}));
      await refunds.settle(order.id,id,processed);
      await refunds.settle(order.id,id,processed);
      await refunds.settle(order.id,id,{...event,status:'failed'});
      assert.equal(await balance(),300);
      assert.equal(await stock(),original+3);
      assert.equal((await state()).payment_status,'partially_refunded');
    } finally {
      await run("UPDATE payments SET status='paid',refunded_amount=0");
      await run("UPDATE orders SET payment_status='paid'");
      await run('UPDATE products SET stock=? WHERE id=1',[original]);
      await run("UPDATE return_requests SET status='pending',refunded_amount=NULL,razorpay_refund_id=NULL,idempotency_key=NULL WHERE id=?",[id]);
    }
  });
  await t.test('pending duplicate request rejected',async()=>{
    await assert.rejects(returns.requestReturn(req(order.items[0]),response()));
    assert.equal((await run('SELECT id FROM return_requests')).length,1);
  });
  let reverseCancelled=false;
  await t.test('review stays pending for the customer and can be declined before pickup',async()=>{
    const start=sentMail.length;
    await returns.adminApproveReturn(admin,response());
    const detail=response();
    await returns.getCustomerReturn(req(order.items[0]),detail);
    assert.equal(detail.body.returnRequest.status,'pending');
    assert.deepEqual(sentMail.slice(start),[]);
    await assert.rejects(returns.adminReceivePackage(admin,response()));
    await returns.adminRejectReturn({...admin,body:{adminNote:'Pickup unavailable'}},response());
    assert.deepEqual(sentMail.slice(start),['returnRejected']);
    await assert.rejects(returns.adminSchedulePickup(admin,response()));
    await setStatus('approved');
    await run("UPDATE return_requests SET shiprocket_return_order_id=101,shiprocket_return_shipment_id=201,idempotency_key=CONCAT('pickup-',id)");
    await returns.adminRejectReturn({...admin,body:{adminNote:'Unable to arrange pickup'}},response());
    assert.equal(reverseCancelled,true);
    reverseCancelled=false;
    await run('UPDATE return_requests SET shiprocket_return_order_id=NULL,shiprocket_return_shipment_id=NULL,idempotency_key=NULL');
  });
  await t.test('international pickup rejected before carrier call',async()=>{
    await setStatus('approved');
    await run("UPDATE orders SET ship_country='Singapore' WHERE id=?",[order.id]);
    try {
      const count=traffic.length;
      await assert.rejects(returns.adminSchedulePickup(admin,response()),{status:422});
      assert.equal(traffic.length,count);
    } finally { await run("UPDATE orders SET ship_country='India' WHERE id=?",[order.id]); }
  });
  await setStatus('approved'); reverseFails=true;
  await t.test('preview sorts eligible rates without booking and stale prices cannot submit',async()=>{
    const start=traffic.length, result=response();
    await returns.adminPickupOptions(admin,result);
    assert.deepEqual(result.body.couriers.map(c=>[c.id,c.rate]),[[61,115.41],[138,348.52]]);
    await assert.rejects(returns.adminSchedulePickup({...admin,body:{...admin.body,courierId:61,quotedRate:99}},response()),{status:409});
    assert.ok(traffic.slice(start).every(call=>!call.url.endsWith('/create/return')));
  });
  await t.test('carrier failure cannot schedule a pickup',async()=>{
    await returns.adminSchedulePickup(admin,response()).catch(()=>{});
    const [row]=await run('SELECT status FROM return_requests WHERE id=?',[ret.body.returnRequest.id]);
    assert.notEqual(row.status,'pickup_scheduled');
  });
  reverseFails=false;
  await t.test('reverse pickup needs confirmation and stores carrier date and selected SKU',async()=>{
    // A new fixture represents a carrier-reconciled prior failed booking.
    await run('UPDATE return_requests SET idempotency_key=NULL WHERE id=?',[ret.body.returnRequest.id]);
    awbConfirmed=false;
    await assert.rejects(returns.adminSchedulePickup(admin,response()),{status:502,message:'AWB pending'});
    const existingOrders=traffic.filter(x=>x.url.endsWith('/create/return')).length;
    awbConfirmed=true;
    pickupConfirmed=false;
    await assert.rejects(returns.adminSchedulePickup(admin,response()));
    assert.equal(traffic.filter(x=>x.url.endsWith('/create/return')).length,existingOrders);
    assert.equal((await run('SELECT status FROM return_requests'))[0].status,'approved');
    const createCount=traffic.filter(x=>x.url.endsWith('/create/return')).length;
    const awbCalls=traffic.filter(x=>x.url.endsWith('/courier/assign/awb'));
    assert.deepEqual(awbCalls.at(-1).body,{shipment_id:201,is_return:1,courier_id:61});
    pickupConfirmed=true;
    assert.equal(sentMail.includes('returnPickupScheduled'),false);
    await returns.adminSchedulePickup(admin,response());
    await returns.adminSchedulePickup(admin,response());
    assert.equal(sentMail.filter(type=>type==='returnPickupScheduled').length,1);
    await assert.rejects(returns.adminRejectReturn({...admin,body:{adminNote:'Too late'}},response()));
    assert.equal(traffic.filter(x=>x.url.endsWith('/create/return')).length,createCount);
    assert.equal(traffic.filter(x=>x.url.endsWith('/courier/assign/awb')).length,awbCalls.length);
    const [row]=await run("SELECT status,DATE_FORMAT(pickup_date,'%Y-%m-%d') AS day,reverse_awb_code FROM return_requests");
    assert.deepEqual([row.status,row.day,row.reverse_awb_code],['pickup_scheduled','2027-01-04','QA-AWB']);
    const payload=traffic.filter(x=>x.url.endsWith('/create/return')).at(-1).body;
    assert.deepEqual(payload.order_items.map(i=>[i.name,i.units]),[['A',3]]);
    assert.equal(String(payload.existing_order_id),'100');
  });
  await setStatus('received');
  refundState='error';
  await t.test('ambiguous Razorpay failure preserves reserved balance and retry key',async()=>{
    await assert.rejects(returns.adminProcessRefund(admin,response()));
    assert.equal((await run('SELECT status FROM return_requests'))[0].status,'refund_processing');
  });
  refundState='pending';
  await t.test('accepted pending refund cannot restore stock or mark refunded',async()=>{
    await returns.adminProcessRefund(admin,response());
    assert.equal((await run('SELECT status FROM return_requests'))[0].status,'refund_initiated');
    assert.equal((await run('SELECT refunded_amount FROM payments'))[0].refunded_amount,0);
    const calls=traffic.filter(x=>x.url.endsWith('/refund'));
    assert.equal(calls.at(-1).headers['X-Refund-Idempotency'],calls.at(-2).headers['X-Refund-Idempotency']);
  });
  const app=require('../src/app');
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
  t.after(()=>server.close());
  config.razorpay.webhookSecret='qa-fixture-secret';
  async function webhook(status) {
    const call=traffic.filter(x=>x.url.endsWith('/refund')).at(-1);
    const entity={id:'rfnd_fixture',payment_id:'pay_fixture',amount:call.body.amount,notes:call.body.notes,status};
    const body=JSON.stringify({event:'refund.'+status,payload:{refund:{entity}}});
    const signature=require('node:crypto').createHmac('sha256',config.razorpay.webhookSecret).update(body).digest('hex');
    const reply=await sendLocal('http://127.0.0.1:'+server.address().port+'/api/webhooks/razorpay',{method:'POST',headers:{'content-type':'application/json','x-razorpay-signature':signature},body});
    assert.equal(reply.status,200);
  }
  await t.test('signed failed webhook releases reservation without restocking',async()=>{
    await webhook('failed');
    assert.equal((await run('SELECT status FROM return_requests'))[0].status,'refund_failed');
    assert.equal((await run('SELECT refunded_amount FROM payments'))[0].refunded_amount,0);
  });
  refundState='processed';
  const before=await run('SELECT stock FROM products ORDER BY id');
  await t.test('processed partial refund restores only A once',async()=>{
    const mailCount=sentMail.filter(type=>type==='returnRefunded').length;
    const count=refundCalls;
    await returns.adminProcessRefund(admin,response());
    assert.equal(traffic.filter(r=>r.url.endsWith('/refund')).at(-1).body.amount,30000);
    await assert.rejects(returns.adminProcessRefund(admin,response()));
    assert.equal(refundCalls,count+1);
    const after=await run('SELECT stock FROM products ORDER BY id');
    assert.deepEqual(after.map((r,i)=>r.stock-before[i].stock),[3,0]);
    await webhook('processed');
    await webhook('processed');
    assert.equal(sentMail.filter(type=>type==='returnRefunded').length,mailCount+1);
    assert.equal((await run('SELECT refunded_amount FROM payments'))[0].refunded_amount,300);
    assert.equal((await run('SELECT stock FROM products WHERE id=1'))[0].stock,after[0].stock);
    assert.equal((await state()).payment_status,'partially_refunded');
  });
  await t.test('refunded quantity cannot be reserved again beyond three',async()=>{
    await assert.rejects(returns.requestReturn(req(order.items[0],3),response()),{status:409});
  });
  await t.test('second product can be requested after A completes',async()=>{
    const result=response(); await returns.requestReturn(req(order.items[1]),result);
    assert.equal(result.body.returnRequest.items[0].order_item_id,order.items[1].id);
  });
  await t.test('discounted merchandise refund respects eligible amount and payment balance',async()=>{
    await run("UPDATE orders SET discount=250,total=270 WHERE id=?",[order.id]);
    await run("UPDATE payments SET amount=270,refunded_amount=150 WHERE order_id=?",[order.id]);
    const [last]=await run('SELECT id,items FROM return_requests ORDER BY id DESC LIMIT 1');
    const items=typeof last.items==='string'?JSON.parse(last.items):last.items;
    items[0].line_total=100;
    await run("UPDATE return_requests SET status='received',refund_amount=100,items=? WHERE id=?",[JSON.stringify(items),last.id]);
    const count=refundCalls;
    await returns.adminProcessRefund({params:{id:last.id},body:{}},response());
    assert.equal(refundCalls,count+1);
    assert.equal(traffic.filter(r=>r.url.endsWith('/refund')).at(-1).body.amount,10000);
  });

  await t.test('INR 500 capture, INR 250 pending then processed over signed HTTP',async()=>{
    await run('DELETE FROM return_requests WHERE order_id=?',[order.id]);
    const [line]=order.items;
    const items=[{order_item_id:line.id,product_id:line.product_id,name:'A',quantity:1,price:250,line_total:250,units:[0]}];
    await run("UPDATE payments SET amount=500,refunded_amount=0,status='paid'");
    await run("UPDATE orders SET total=500,subtotal=500,discount=0,shipping_fee=0,payment_status='paid'");
    await run('UPDATE order_items SET price=250,quantity=1 WHERE order_id=?',[order.id]);
    const r=await run("INSERT INTO return_requests(order_id,user_id,reason,items,status,refund_amount) VALUES(?,1,'fixture',?,'received',250)",[order.id,JSON.stringify(items)]);
    const before=await run('SELECT stock FROM products ORDER BY id');
    refundState='pending';
    await returns.adminProcessRefund({params:{id:r.insertId},body:{}},response());
    assert.equal((await run('SELECT refunded_amount FROM payments'))[0].refunded_amount,0);
    await webhook('processed'); await webhook('processed');
    const [payment]=await run('SELECT amount,refunded_amount,status FROM payments');
    assert.deepEqual([payment.refunded_amount,payment.amount-payment.refunded_amount,payment.status],[250,250,'partially_refunded']);
    const after=await run('SELECT stock FROM products ORDER BY id');
    assert.deepEqual(after.map((r,i)=>r.stock-before[i].stock),[1,0]);
  });

  const adminOrders=require('../src/controllers/admin/orderController');
  const stock=async()=> (await run('SELECT stock FROM products ORDER BY id')).map(i=>i.stock);
  const cancel=items=>orderApi.cancel({user,params:{orderNumber:order.order_number},body:{items,reason:'Fixture cancellation'}},response());
  const approve=()=>adminOrders.approveCancellation(admin,response());
  await t.test('paid cancellation reserves discounted A and preserves stock while pending',async()=>{
    await run('DELETE FROM return_requests WHERE order_id=?',[order.id]);
    await run("UPDATE payments SET amount=470,refunded_amount=0,status='paid'");
    await run("UPDATE orders SET status='confirmed',payment_status='paid',subtotal=500,discount=50,shipping_fee=20,total=470,cancelled_items=NULL");
    await run('UPDATE order_items SET quantity=2,price=125 WHERE id=?',[order.items[0].id]);
    const selection=[{orderItemId:order.items[0].id,quantity:2}];
    const confirmedDetail=response();
    await orderApi.detail({user,params:{orderNumber:order.order_number}},confirmedDetail);
    assert.equal(confirmedDetail.body.canCancel,false);
    await assert.rejects(cancel(selection),{status:409});
    await run("UPDATE orders SET status='placed' WHERE id=?",[order.id]);
    await assert.rejects(cancel([{...selection[0],quantity:1}]),{status:400});
    await assert.rejects(cancel([...selection,...selection]));
    await cancel(selection);
    assert.equal((await state()).cancellation_refund_amount,225);
    const before=await stock(), start=refundCalls;
    refundState='error'; await assert.rejects(approve());
    refundState='pending'; await approve(); await approve();
    const attempts=traffic.filter(x=>x.url.endsWith('/refund')).slice(-2);
    assert.equal(attempts[0].headers['X-Refund-Idempotency'],attempts[1].headers['X-Refund-Idempotency']);
    assert.equal(refundCalls,start+2);
    assert.equal((await state()).items.length,2);
    assert.deepEqual(await stock(),before);
    assert.equal((await run('SELECT refunded_amount FROM payments'))[0].refunded_amount,0);
    await assert.rejects(adminOrders.rejectCancellation(admin,response()),{status:409});
  });
  await t.test('failed cancellation retry and repeated signed completion settle A once',async()=>{
    const mailCount=sentMail.filter(type=>type==='orderStatus').length;
    const before=await stock();
    const oldKey=traffic.filter(x=>x.url.endsWith('/refund')).at(-1).body.notes.idempotencyKey;
    await webhook('failed'); await webhook('failed');
    refundState='pending'; await approve();
    assert.notEqual(traffic.filter(x=>x.url.endsWith('/refund')).at(-1).body.notes.idempotencyKey,oldKey);
    await webhook('processed'); await webhook('processed'); await webhook('failed');
    assert.equal(sentMail.filter(type=>type==='orderStatus').length,mailCount+1);
    const updated=await state();
    assert.equal(updated.status,'confirmed');
    assert.deepEqual(updated.items.map(i=>i.id),[order.items[1].id]);
    assert.deepEqual([updated.subtotal,updated.discount,updated.total],[250,25,245]);
    assert.deepEqual((await stock()).map((v,i)=>v-before[i]),[2,0]);
    assert.deepEqual((await run('SELECT status,refunded_amount FROM payments'))[0],{status:'partially_refunded',refunded_amount:225});
  });
  await t.test('full cancellation of remaining B refunds shipping and original balance once',async()=>{
    const before=await stock();
    await assert.rejects(cancel(undefined),{status:409});
    // Exercise the full refund path with an eligible pre-confirmation fixture.
    await run("UPDATE orders SET status='placed' WHERE id=?",[order.id]);
    await cancel(undefined);
    refundState='processed'; await approve();
    await assert.rejects(approve());
    await webhook('processed');
    assert.deepEqual((await run('SELECT status,refunded_amount FROM payments'))[0],{status:'refunded',refunded_amount:470});
    assert.deepEqual((await stock()).map((v,i)=>v-before[i]),[0,1]);
    const updated=await state();
    assert.equal(updated.cancelled_items.length,2);
    assert.equal(updated.status,'cancelled');
  });

  await t.test('COD cancels all of selected A and retains B at its discounted total',async()=>{
    await run("UPDATE orders SET status='placed',payment_method='cod',payment_status='pending',subtotal=500,discount=50,total=470,cancelled_items=NULL,cancelled_amount=0");
    const added=await run("INSERT INTO order_items(order_id,product_id,name,price,quantity) VALUES (?,1,'A',125,2)",[order.id]);
    const before=await stock();
    await assert.rejects(cancel([{orderItemId:added.insertId,quantity:1}]),{status:400});
    await cancel([{orderItemId:added.insertId,quantity:2}]);
    await approve();
    const updated=await state();
    assert.deepEqual(updated.items.map(i=>[i.product_id,i.quantity]),[[2,1]]);
    assert.deepEqual([updated.subtotal,updated.discount,updated.total],[250,25,245]);
    assert.deepEqual((await stock()).map((v,i)=>v-before[i]),[2,0]);
  });

});
