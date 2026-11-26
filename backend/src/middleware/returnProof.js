const crypto = require('crypto');
const path = require('path');
const config = require('../config/env');
const prefix = '/uploads/returns/';
const valid = /^[\w-]+\.(webp|png|jpg|jpeg|gif|mp4|webm|mov)$/i;
function signature(name, expiry) {
  return crypto.createHmac('sha256',config.jwt.secret).update('return-proof/'+name+'/'+expiry).digest('hex');
}
// Only customer-owned and admin return responses reach this serializer.
function signProofs(req,res,next) {
  const json = res.json;
  res.json = function(body) {
    const rows = new Set([body?.returnRequest,...(body?.returnRequests || []),...(Array.isArray(body?.items) ? body.items : [])]);
    const expiry = Math.floor(Date.now()/1000)+1800;
    for (const row of rows) {
      if (!Array.isArray(row?.attachments)) continue;
      row.attachments = row.attachments.map(a => {
        const name = a.url?.slice(prefix.length);
        if (!a.url?.startsWith(prefix) || !valid.test(name)) return a;
        return {...a,url:prefix+name+'?expires='+expiry+'&signature='+signature(name,expiry)};
      });
    }
    return json.call(this,body);
  };
  next();
}
function serveProof(req,res) {
  const name=req.params.name, expiry=Number(req.query.expires);
  const supplied=String(req.query.signature || '');
  if (!valid.test(name) || !Number.isSafeInteger(expiry) || expiry < Date.now()/1000 ||
      !/^[a-f0-9]{64}$/.test(supplied) || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(signature(name,expiry))))
    return res.sendStatus(403);
  res.set('Cache-Control','private, no-store');
  return res.sendFile(name,{root:path.join(config.uploadsDir,'returns'),cacheControl:false});
}
module.exports = {signProofs,serveProof};
