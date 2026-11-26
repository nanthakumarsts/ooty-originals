const { q } = require('../config/db');
const { HttpError } = require('../middleware/error');

const deliveredItems = `FROM orders o
  JOIN order_items i ON i.order_id=o.id
  JOIN products p ON p.id=i.product_id AND p.is_active=1
  WHERE o.user_id=? AND (o.status='delivered' OR
    (o.status='returned' AND EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id=o.id AND h.status='delivered')))`;
const deliveredOrder = `SELECT o.id ${deliveredItems} AND i.product_id=? ORDER BY o.id DESC LIMIT 1`;

async function mine(req,res) {
  const items = await q(`SELECT d.product_id,d.name,d.image,r.status,r.rating,r.feedback
    FROM (SELECT p.id AS product_id,p.name,MAX(i.image) AS image,MAX(o.id) AS last_order
      ${deliveredItems} GROUP BY p.id,p.name) d
    LEFT JOIN product_reviews r ON r.product_id=d.product_id AND r.user_id=?
    ORDER BY (r.id IS NULL) DESC,d.last_order DESC,d.product_id`, [req.user.id,req.user.id]);
  res.set('Cache-Control','private, no-store').json({items});
}

function offset(page) {
  const value = Number(page ?? 1);
  if (!Number.isSafeInteger(value) || value < 1 || value > 1000000) throw new HttpError(400, 'Invalid page');
  return (value - 1) * 20;
}

async function list(req, res) {
  const id = req.params.id;
  const start = offset(req.query.page);
  const rows = await q(`SELECT r.id,r.rating,r.feedback,r.created_at,SUBSTRING_INDEX(TRIM(u.name),' ',1) AS author
    FROM product_reviews r JOIN users u ON u.id=r.user_id JOIN products p ON p.id=r.product_id
    WHERE r.product_id=? AND r.status='published' AND p.is_active=1 ORDER BY r.id DESC LIMIT 21 OFFSET ?`, [id,start]);
  res.json({items:rows.slice(0,20), hasMore:rows.length > 20});
}

async function submit(req,res) {
  const {rating, feedback} = req.body || {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof feedback !== 'string' ||
      !feedback.trim() || feedback.trim().length > 2000) throw new HttpError(400,'Choose 1–5 stars and write a review of up to 2,000 characters.');
  const id = req.params.id;
  try {
    const result = await q(`INSERT INTO product_reviews(product_id,user_id,rating,feedback,order_id)
      SELECT ?,?,?,?,delivery.id FROM (${deliveredOrder}) delivery`,[id,req.user.id,rating,feedback.trim(),req.user.id,id]);
    if (!result.affectedRows) throw new HttpError(403,'You can review this product after delivery.');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409,'You have already reviewed this product.');
    throw error;
  }
  res.status(201).json({status:'pending'});
}

const statuses = ['pending','published','rejected'];
async function queue(req,res) {
  const {status='all', search='', rating=''} = req.query;
  if ((status !== 'all' && !statuses.includes(status)) || typeof search !== 'string' || search.length > 200 ||
      (rating !== '' && !/^[1-5]$/.test(rating))) throw new HttpError(400,'Invalid review filters');
  const start = offset(req.query.page);
  const joins = ` FROM product_reviews r JOIN users u ON u.id=r.user_id JOIN products p ON p.id=r.product_id
    JOIN orders o ON o.id=r.order_id WHERE 1=1`;
  let where = joins;
  const args = [];
  if (rating) { where += ' AND r.rating=?'; args.push(rating); }
  if (search.trim()) {
    where += ' AND (p.name LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR o.order_number LIKE ? OR r.feedback LIKE ?)';
    args.push(...Array(5).fill('%'+search.trim()+'%'));
  }
  const counts = {pending:0,published:0,rejected:0};
  for (const row of await q('SELECT r.status,COUNT(*) AS n'+where+' GROUP BY r.status',args)) counts[row.status] = Number(row.n);
  if (status !== 'all') { where += ' AND r.status=?'; args.push(status); }
  const items = await q(`SELECT r.id,r.rating,r.feedback,r.created_at,r.status,p.name AS product,u.name AS customer,
    o.order_number`+where+' ORDER BY r.id DESC LIMIT 20 OFFSET ?', [...args,start]);
  res.json({items, counts});
}

async function moderate(req,res) {
  const {status, previous} = req.body || {};
  if (!['published','rejected'].includes(status) || !statuses.includes(previous))
    throw new HttpError(400,'Invalid moderation decision');
  const result = await q('UPDATE product_reviews SET status=? WHERE id=? AND status=?',[status,req.params.id,previous]);
  if (!result.affectedRows) throw new HttpError(409,'This review changed. Refresh the queue.');
  res.json({status});
}
module.exports = {list,mine,submit,queue,moderate};
