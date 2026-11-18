import { useState } from 'react';
import api from '../lib/api';
import { useApp } from '../context/AppContext';
import { Alert, Button, Field, PageHeader, usePageTitle } from '../components/ui';

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

function PasswordCard() {
  const { toast } = useApp();
  const empty = { currentPassword: '', newPassword: '', confirm: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    const problems = {};
    if (!form.currentPassword) problems.currentPassword = 'Enter your current password';
    if (form.newPassword.length < 8) problems.newPassword = 'Use at least 8 characters';
    else if (!/[A-Za-z]/.test(form.newPassword) || !/\d/.test(form.newPassword)) problems.newPassword = 'Use at least one letter and one number';
    if (form.newPassword !== form.confirm) problems.confirm = 'Passwords do not match';
    if (Object.keys(problems).length) return setErrors(problems);
    setBusy(true);
    setErrors({});
    try {
      await api.put('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm(empty);
      toast.success('Password updated');
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <form onSubmit={submit} noValidate className="card space-y-4 p-5">
      <h2 className="card-title">Change password</h2>
      {message && !Object.keys(errors).length && <Alert>{message}</Alert>}
      <Field label="Current password" type="password" required autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} />
      <Field label="New password" type="password" required autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} error={errors.newPassword} hint="At least 8 characters, with a letter and a number." />
      <Field label="Confirm new password" type="password" required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
      <Button type="submit" loading={busy}>Update password</Button>
    </form>
  );
}

export default function Account() {
  usePageTitle('My account');
  return (
    <>
      <PageHeader title="My account" description="Your administrator profile and password." />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
      </div>
    </>
  );
}
