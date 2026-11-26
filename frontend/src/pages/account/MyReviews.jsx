import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import api from '../../lib/api';
import { img } from '../../lib/format';
import { usePageTitle } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const statuses = {pending:'Awaiting approval', published:'Published', rejected:'Declined'};

function ReviewForm({ product, onSaved, onCancel, onRefresh }) {
  const [rating,setRating] = useState(0);
  const [feedback,setFeedback] = useState('');
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api.post(`/products/${product.product_id}/reviews`, {rating,feedback});
      onSaved({...product,status:result.status,rating,feedback:feedback.trim()});
    } catch(err) {
      if (err.status === 409) onRefresh();
      else setError(err.message);
    } finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-sand-200 bg-sand-50 p-5">
        <fieldset><legend className="font-semibold">Rate your purchase</legend>
          <div className="mt-1 flex">{[1,2,3,4,5].map(n => <label key={n} className="cursor-pointer">
            <input className="peer sr-only" type="radio" name="rating" required value={n} checked={rating===n} onChange={() => setRating(n)} aria-label={n+' stars'} />
            <span className="flex size-11 items-center justify-center rounded-lg text-brand-600 peer-focus-visible:ring-2"><Star size={25} fill={rating>=n?'currentColor':'none'} /></span>
          </label>)}</div>
        </fieldset>
        <label className="block font-semibold">Your review<textarea required maxLength={2000} rows={3} value={feedback} onChange={e=>setFeedback(e.target.value)} className="mt-2 block w-full rounded-xl border border-sand-300 bg-white p-3 font-normal" /></label>
        <p className="text-sm text-ink-600">The store checks reviews before publishing them.</p>
        <button className="btn btn-primary" disabled={saving || !feedback.trim() || !rating}>{saving?'Submitting…':'Submit review'}</button>
        <button type="button" className="btn btn-ghost ml-2" disabled={saving} onClick={onCancel}>Cancel</button>
        {error && <p role="alert" className="text-clay-700">{error}</p>}
      </form>;
}

export default function MyReviews() {
  usePageTitle('My reviews');
  const {user} = useAuth();
  return <DeliveredProducts key={user.id} />;
}

function DeliveredProducts() {
  const [items,setItems] = useState(null);
  const [active,setActive] = useState(null);
  const [error,setError] = useState('');
  const [revision,refresh] = useState(0);
  useEffect(() => {
    let current = true;
    setError('');
    api.get('/account/reviews').then(result => { if (current) setItems(result.items); })
      .catch(err => { if (current) setError(err.message); });
    return () => { current=false; };
  },[revision]);
  function saved(updated) {
    setItems(list => list.map(item => item.product_id===updated.product_id ? updated : item));
    setActive(null);
  }
  return <section>
    <h2 className="mb-2 text-2xl font-medium">My reviews</h2>
    <p className="mb-6 text-sm text-ink-600">Review products from your delivered orders.</p>
    {error && <p role="alert">{error} <button className="underline" onClick={()=>refresh(v=>v+1)}>Retry</button></p>}
    {!error && !items && <p role="status">Loading your products?</p>}
    {items?.length===0 && <p className="card p-5">Your products will appear here after delivery.</p>}
    <ul className="space-y-3">{items?.map(product => <li className="card space-y-4 p-4 sm:p-5" key={product.product_id}>
      <div className="flex flex-wrap items-center gap-4">
        {product.image && <img src={img(product.image)} alt="" className="size-16 rounded-xl object-cover" />}
        <div className="min-w-32 flex-1"><h3 className="font-semibold">{product.name}</h3>
          {product.status && <p role="status" className="text-sm text-ink-600">{statuses[product.status]} ? {product.rating}/5</p>}
        </div>
        {!product.status && active!==product.product_id && <button className="btn btn-primary" onClick={()=>setActive(product.product_id)}>Write a review</button>}
      </div>
      {product.status && <p className="whitespace-pre-wrap break-words text-sm">{product.feedback}</p>}
      {!product.status && active===product.product_id && <ReviewForm product={product} onSaved={saved}
        onCancel={()=>setActive(null)} onRefresh={()=>{ setActive(null); refresh(v=>v+1); }} />}
    </li>)}</ul>
  </section>;
}
