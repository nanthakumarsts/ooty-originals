import { useEffect, useState } from 'react';
import api from '../../lib/api';

export default function ProductReviews({ productId }) {
  const [page, setPage] = useState(1);
  const [revision, refresh] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const url = `/products/${productId}/reviews`;

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    api.get(url, { params: { page } }).then(result => {
      if (active) setData(result);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [url,page,revision]);

  return <div className="space-y-6">
    <h2 className="text-2xl font-medium">Customer reviews</h2>
    {error && <p role="alert" className="text-clay-700">{error} <button className="underline" onClick={() => refresh(v => v+1)}>Refresh</button></p>}
    {!data && !error && <p role="status">Loading reviews…</p>}
    {data && <>
      {data.items.length === 0 && <p className="text-ink-500">No published reviews yet.</p>}
      <ul className="divide-y divide-sand-200">{data.items.map(review => <li key={review.id} className="space-y-2 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3"><strong>{review.author}</strong><span className="text-xs text-brand-700">Verified purchase</span>
          <time className="text-xs text-ink-500">{new Date(review.created_at).toLocaleDateString('en-IN')}</time></div>
        <span aria-label={review.rating+' out of 5 stars'} className="text-brand-600">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span>
        <p className="whitespace-pre-wrap break-words">{review.feedback}</p>
      </li>)}</ul>
      {(page>1 || data.hasMore) && <div className="flex gap-4"><button className="btn btn-ghost" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><button className="btn btn-ghost" disabled={!data.hasMore} onClick={()=>setPage(page+1)}>Next</button></div>}
    </>}
  </div>;
}
