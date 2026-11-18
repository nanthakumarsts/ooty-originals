import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { useApp } from '../context/AppContext';
import { Alert, Button, Field, usePageTitle } from '../components/ui';
import { AuthFrame } from './Login';

const backLink = <p className="mt-5 text-center text-sm"><Link to="/login" className="font-medium text-brand-600 hover:underline">Back to sign in</Link></p>;

export function ForgotPassword() {
  usePageTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await publicApi.post('/auth/forgot-password', { email, from: 'admin' });
      setSent(true);
    } catch (err) {
      setError(err.fields?.email || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Reset your password" subtitle="We will email you a link to choose a new one.">
      {sent ? (
        <Alert tone="success">If an administrator account exists for {email}, a reset link is on its way. It is valid for 60 minutes.</Alert>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Email address" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={busy} className="min-h-11 w-full">Send reset link</Button>
        </form>
      )}
      {backLink}
    </AuthFrame>
  );
}

export function ResetPassword() {
  usePageTitle('Choose a new password');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useApp();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (form.password !== form.confirm) return setErrors({ confirm: 'Passwords do not match' });
    setBusy(true);
    setErrors({});
    try {
      await publicApi.post('/auth/reset-password', { token, password: form.password });
      toast.success('Password updated. Please sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.message);
      setBusy(false);
    }
    return undefined;
  };

  return (
    <AuthFrame title="Choose a new password">
      {!token ? (
        <Alert>This reset link is incomplete. Open the link from your email again or request a new one.</Alert>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {message && !errors.password && <Alert>{message}</Alert>}
          <Field label="New password" type="password" required autoFocus autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} hint="At least 8 characters, with a letter and a number." />
          <Field label="Confirm new password" type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} error={errors.confirm} />
          <Button type="submit" loading={busy} className="min-h-11 w-full">Update password</Button>
        </form>
      )}
      {backLink}
    </AuthFrame>
  );
}
