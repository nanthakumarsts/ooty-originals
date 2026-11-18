import { useState } from 'react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { matches, password, required, useValidation } from '../../lib/validation';
import { Alert, Button, Field, usePageTitle } from '../../components/ui';

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' };

const RULES = {
  currentPassword: [required('Enter your current password')],
  newPassword: [
    required('Choose a new password'),
    password(),
    (value, all) => (value && value === all.currentPassword ? 'Choose a password different from the current one' : ''),
  ],
  confirm: [required('Type the new password again'), matches('newPassword', 'Passwords do not match')],
};

export default function ChangePassword() {
  usePageTitle('Change password');
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const v = useValidation(RULES, form);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!v.check()) return;
    setBusy(true);
    try {
      await api.put('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm(EMPTY);
      v.reset();
      toast.success('Password updated');
    } catch (err) {
      if (Object.keys(err.fields || {}).length) v.setServerErrors(err.fields);
      else if (/current password/i.test(err.message)) v.setServerErrors({ currentPassword: err.message });
      else setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card max-w-xl p-6 sm:p-8">
      <h2 className="text-2xl font-medium">Change password</h2>
      <p className="mt-1 text-ink-500">Use a password you do not use anywhere else.</p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        {message && <Alert>{message}</Alert>}
        <Field label="Current password" type="password" required value={form.currentPassword} onChange={set('currentPassword')} {...v.bind('currentPassword')} autoComplete="current-password" />
        <Field label="New password" type="password" required value={form.newPassword} onChange={set('newPassword')} {...v.bind('newPassword')} autoComplete="new-password" hint="At least 8 characters, with a letter and a number." />
        <Field label="Confirm new password" type="password" required value={form.confirm} onChange={set('confirm')} {...v.bind('confirm')} autoComplete="new-password" />
        <Button type="submit" loading={busy}>Update password</Button>
      </form>
    </section>
  );
}
