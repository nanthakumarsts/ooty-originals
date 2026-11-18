import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import api from '../../lib/api';
import { email, required, useValidation } from '../../lib/validation';
import { Alert, Button, Field, usePageTitle } from '../../components/ui';
import AuthShell from './AuthShell';

const RULES = { email: [required('Enter your email address'), email()] };

export default function ForgotPassword() {
  usePageTitle('Forgot password');
  const [form, setForm] = useState({ email: '' });
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const v = useValidation(RULES, form);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!v.check()) return;
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: form.email.trim() });
      setSent(true);
    } catch (err) {
      v.setServerErrors(err.fields);
      setError(err.message || 'No account found with this email address. Please create a new account.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your inbox" footer={<Link to="/login" className="link">Back to sign in</Link>}>
        <div className="flex items-start gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-5 text-brand-700">
          <MailCheck className="mt-0.5 size-6 shrink-0" aria-hidden />
          <p className="leading-relaxed">We have sent a link to reset your password to <strong>{form.email}</strong>. It is valid for 5 minutes.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we will send you a reset link." footer={<Link to="/login" className="link">Back to sign in</Link>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && (
          <Alert>
            <div className="space-y-1">
              <p>{error}</p>
              {/no account/i.test(error) && (
                <p className="pt-1 text-sm">
                  Don't have an account yet? <Link to="/register" className="font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-900">Create an account here →</Link>
                </p>
              )}
            </div>
          </Alert>
        )}
        <Field label="Email address" type="email" required value={form.email} onChange={(e) => setForm({ email: e.target.value })} {...v.bind('email')} autoComplete="email" autoFocus />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
      </form>
    </AuthShell>
  );
}
