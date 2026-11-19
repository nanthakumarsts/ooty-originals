import { useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import AddressForm from '../../components/AddressForm';
import { Badge, Button, EmptyState, Modal, usePageTitle } from '../../components/ui';
import { RowsSkeleton } from '../../components/Skeletons';

export default function Addresses() {
  usePageTitle('My addresses');
  const { user } = useAuth();
  const toast = useToast();
  const [addresses, setAddresses] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, address = edit
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/addresses').then((d) => setAddresses(d.addresses)).catch((err) => { toast.error(err.message); setAddresses([]); });
  }, [toast]);

  const saved = (list) => {
    setAddresses(list);
    toast.success(editing?.id ? 'Address updated' : 'Address saved');
    setEditing(null);
  };

  const makeDefault = async (address) => {
    try {
      setAddresses((await api.patch(`/addresses/${address.id}/default`)).addresses);
      toast.success('Default address updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      setAddresses((await api.delete(`/addresses/${removing.id}`)).addresses);
      toast.success('Address removed');
      setRemoving(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!addresses) return <RowsSkeleton count={2} thumb={false} />;

  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-medium">Delivery addresses</h2>
        {addresses.length > 0 && (
          <Button size="sm" onClick={() => setEditing({})}><Plus className="size-4" aria-hidden /> Add address</Button>
        )}
      </div>

      {!addresses.length ? (
        <div className="card">
          <EmptyState icon={MapPin} title="No saved addresses" description="Add an address to check out faster next time.">
            <Button onClick={() => setEditing({})}><Plus className="size-4" aria-hidden /> Add address</Button>
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="card flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{a.full_name}</p>
                <Badge>{a.label}</Badge>
                {!!a.is_default && <Badge tone="green">Default</Badge>}
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-500">
                {a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} – {a.pincode}{a.country ? `, ${a.country}` : ''}<br />Phone: {a.phone}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-1 pt-4">
                <button type="button" onClick={() => setEditing(a)} className="btn btn-ghost btn-sm"><Pencil className="size-4" aria-hidden /> Edit</button>
                <button type="button" onClick={() => setRemoving(a)} className="btn btn-ghost btn-sm text-clay-600 hover:bg-clay-50"><Trash2 className="size-4" aria-hidden /> Remove</button>
                {!a.is_default && <button type="button" onClick={() => makeDefault(a)} className="btn btn-ghost btn-sm ml-auto text-brand-600">Set as default</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit address' : 'Add a new address'} wide>
        {editing && <AddressForm key={editing.id || 'new'} address={editing.id ? editing : null} defaultName={user.name} defaultPhone={user.phone} onSaved={saved} onCancel={() => setEditing(null)} />}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remove this address?">
        <p className="text-ink-500">{removing?.full_name}, {removing?.line1}, {removing?.city} will be removed from your account. Past orders are not affected.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setRemoving(null)}>Keep address</Button>
          <Button onClick={remove} loading={busy} className="bg-clay-600 hover:bg-[#9c3525]">Remove address</Button>
        </div>
      </Modal>
    </section>
  );
}
