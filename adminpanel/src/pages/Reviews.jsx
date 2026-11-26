import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/format';
import { Badge, Button, EmptyState, PageHeader, TableSkeleton, usePageTitle } from '../components/ui';
import { useApp } from '../context/AppContext';

const labels = { pending:'Pending', published:'Published', rejected:'Rejected', all:'All reviews' };
const tones = { pending:'amber', published:'green', rejected:'red' };

export default function Reviews() {
  usePageTitle('Product reviews');
  const { toast } = useApp();
  const [status,setStatus] = useState('pending');
  const [search,setSearch] = useState('');
  const [rating,setRating] = useState('');
  const [page,setPage] = useState(1);
  const [data,setData] = useState(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(null);
  const [revision,refresh] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    const timer = setTimeout(() => {
      api.get('/reviews',{params:{status,search,rating,page}}).then(result => {
        if (!active) return;
        if (!result.items.length && page>1) setPage(page-1);
        else setData(result);
      }).catch(err => { if(active) setError(err.message); });
    },150);
    return () => { active = false; clearTimeout(timer); };
  },[status,search,rating,page,revision]);

  async function decide(review,next) {
    setBusy(review.id);
    try {
      await api.patch('/reviews/'+review.id,{status:next,previous:review.status});
      toast.success(next==='published'?'Review published':'Review rejected');
    } catch(err) { toast.error(err.message); }
    finally { setBusy(null); refresh(v=>v+1); }
  }
  const counts = data?.counts;
  const total = counts ? Object.values(counts).reduce((a,b)=>a+b,0) : 0;
  const pages = Math.ceil((status==='all'?total:counts?.[status] || 0)/20);
  return <>
    <PageHeader title="Product reviews" description="Read feedback from delivered orders and choose which reviews appear in the store." />
    <div className="card overflow-hidden">
      <div className="flex flex-wrap gap-2 border-b border-line p-4">{Object.entries(labels).map(([key,label])=>
        <Button key={key} size="sm" variant={status===key?'primary':'outline'} aria-pressed={status===key} onClick={()=>{setStatus(key);setPage(1);}}>
          {label}{counts && ' ('+(key==='all'?total:counts[key])+')'}
        </Button>)}</div>
      <div className="flex flex-wrap gap-3 border-b border-line p-4">
        <input type="search" aria-label="Search reviews" className="input min-w-48 flex-1" maxLength={200} placeholder="Search product, customer, order or review" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} />
        <select aria-label="Filter by rating" className="input max-w-40" value={rating} onChange={e=>{setRating(e.target.value);setPage(1);}}>
          <option value="">All ratings</option>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}
        </select>
      </div>
      {error ? <div role="alert" className="p-5">{error} <Button variant="outline" onClick={()=>refresh(v=>v+1)}>Retry</Button></div> :
        !data ? <TableSkeleton /> : !data.items.length ? <EmptyState icon={Star} title="No matching reviews" /> :
        <ul className="divide-y divide-line">{data.items.map(review=><li key={review.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_2fr_auto]">
          <div><p className="font-semibold">{review.product}</p><p className="mt-1 text-sm text-ink-600">{review.customer}</p><p className="text-xs text-ink-500">{review.order_number}</p></div>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><span className="text-amber-700" aria-label={review.rating+' out of 5 stars'}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span><time className="text-xs text-ink-500">{formatDate(review.created_at)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{review.feedback}</p></div>
          <div className="flex flex-wrap items-start gap-2 lg:flex-col lg:items-end"><Badge tone={tones[review.status]}>{labels[review.status]}</Badge>
            <div className="flex gap-2">{review.status!=='published' && <Button size="sm" disabled={busy!==null} onClick={()=>decide(review,'published')}>Approve</Button>}
            {review.status!=='rejected' && <Button size="sm" variant="outline" disabled={busy!==null} onClick={()=>decide(review,'rejected')}>Reject</Button>}</div>
          </div>
        </li>)}</ul>}
      {pages>1 && <div className="flex items-center justify-end gap-4 border-t border-line p-4"><Button size="sm" variant="outline" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</Button><span>{page} / {pages}</span><Button size="sm" variant="outline" disabled={page===pages} onClick={()=>setPage(page+1)}>Next</Button></div>}
    </div>
  </>;
}
