import { useState } from 'react';
import api from '../lib/api';
import { useApp } from '../context/AppContext';
import { Button, Field, PageHeader, usePageTitle } from '../components/ui';

function ProfileCard() {
  const { admin, setAdmin, toast } = useApp();
  const [form, setForm] = useState({ name: admin.name, phone: admin.phone || '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const problems = {};
    if (form.name.trim().length < 2) problems.name = 'Enter your name';
    if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, ''))) problems.phone = 'Enter a 10-digit mobile number';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      setAdmin((await api.put('/auth/profile', form)).user);
      toast.success('Profile updated');
    } catch (err) {
      setErrors(err.fields || {});
      if (!Object.keys(err.fields || {}).length) toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="card space-y-4 p-5">
      <h2 className="card-title">Profile</h2>
      <Field label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
      <Field label="Email" type="email" value={admin.email} disabled readOnly hint="Used to sign in." />
      <Field label="Mobile number" required type="tel" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
      <Button type="submit" loading={busy}>Save profile</Button>
    </form>
  );
}

export default function Account() {
  usePageTitle('My account');
  return (
    <>
      <PageHeader title="My account" description="Your administrator profile." />
      <div className="max-w-xl">
        <ProfileCard />
      </div>
    </>
  );
}
