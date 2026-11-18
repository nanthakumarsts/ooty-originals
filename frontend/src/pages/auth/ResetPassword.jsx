import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { matches, password, required, useValidation } from '../../lib/validation';
import { Alert, Button, Field, usePageTitle } from '../../components/ui';
import AuthShell from './AuthShell';

const RULES = {
  password: [required('Choose a new password'), password()],
  confirm: [required('Type the password again'), matches('password', 'Passwords do not match')],
};

export default function ResetPassword() {
  usePageTitle('Reset password');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { logout } = useAuth();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
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
      const d = await api.post('/auth/reset-password', { token, password: form.password });
      logout();
      toast.success(d.message || 'Password updated successfully! Please sign in.');
      navigate('/login', { replace: true, state: { resetSuccess: true } });
    } catch (err) {
      v.setServerErrors(err.fields);
      if (!err.fields?.password) setMessage(err.message);
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Reset link missing" footer={<Link to="/forgot-password" className="link">Request a new link</Link>}>
        <Alert>This password reset link is incomplete. Please open the link from your email again, or request a new one.</Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" footer={<Link to="/login" className="link">Back to sign in</Link>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {message && <Alert>{message}</Alert>}
        <Field label="New password" type="password" required value={form.password} onChange={set('password')} {...v.bind('password')} autoComplete="new-password" hint="At least 8 characters, with a letter and a number." autoFocus />
        <Field label="Confirm new password" type="password" required value={form.confirm} onChange={set('confirm')} {...v.bind('confirm')} autoComplete="new-password" />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
      </form>
    </AuthShell>
  );
}
