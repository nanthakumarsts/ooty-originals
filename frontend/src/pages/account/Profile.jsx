import { useState } from 'react';
import api from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { minLength, onlyDigits, phone, required, useValidation } from '../../lib/validation';
import { Alert, Button, Field, usePageTitle } from '../../components/ui';

const RULES = {
  name: [required('Enter your full name'), minLength(2, 'Enter your full name')],
  phone: [required('Enter your mobile number'), phone()],
};

export default function Profile() {
  usePageTitle('My account');
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const v = useValidation(RULES, form);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: key === 'phone' ? onlyDigits(e.target.value, 10) : e.target.value }));
  const dirty = form.name !== user.name || form.phone !== (user.phone || '');

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!v.check()) return;
    setBusy(true);
    try {
      const d = await api.put('/auth/profile', { name: form.name.trim(), phone: form.phone });
      setUser(d.user);
      setForm({ name: d.user.name, phone: d.user.phone || '' });
      toast.success('Profile updated');
    } catch (err) {
      v.setServerErrors(err.fields);
      if (!Object.keys(err.fields || {}).length) setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card max-w-2xl p-6 sm:p-8">
      <h2 className="text-2xl font-medium">Personal details</h2>
      <p className="mt-1 text-ink-500">Member since {formatDate(user.created_at)}</p>
      <form onSubmit={submit} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
        {message && <Alert className="sm:col-span-2">{message}</Alert>}
        <Field className="sm:col-span-2" label="Full name" required value={form.name} onChange={set('name')} {...v.bind('name')} autoComplete="name" />
        <Field label="Email address" type="email" value={user.email} disabled readOnly hint="Your email is used to sign in and cannot be changed." />
        <Field label="Mobile number" type="tel" inputMode="numeric" required value={form.phone} onChange={set('phone')} {...v.bind('phone')} autoComplete="tel-national" />
        <div className="sm:col-span-2">
          <Button type="submit" loading={busy} disabled={!dirty}>Save changes</Button>
        </div>
      </form>
    </section>
  );
}
