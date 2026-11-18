import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Alert, Button, Field, usePageTitle } from '../components/ui';

/** Frame shared by the sign-in and password pages. */
export function AuthFrame({ title, subtitle, children }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-900 lg:block">
        <img src="/images/hero-estate.webp" alt="" className="absolute inset-0 size-full object-cover object-[center_60%] opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/40 to-brand-900/30" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <img src="/images/logo-white.png" alt="Sannara" className="h-14 w-auto self-start" />
          <div>
            <p className="font-display text-4xl leading-tight">Run the store.<br />Keep the hills moving.</p>
            <p className="mt-4 max-w-sm text-white/75">Orders, products, customers and website content — all in one place.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center bg-white px-5 py-12">
        <div className="w-full max-w-sm">
          <img src="/images/logo.png" alt="Sannara" className="mb-8 h-12 w-auto lg:hidden" />
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">
            <ShieldCheck className="size-4" aria-hidden /> Admin panel
          </p>
          <h1 className="text-3xl font-medium">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-500">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  usePageTitle('Sign in');
  const { login } = useApp();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    const problems = {};
    if (!form.email.trim()) problems.email = 'Enter your email address';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) problems.email = 'Enter a valid email address';
    if (!form.password) problems.password = 'Enter your password';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      await login(form);
    } catch (err) {
      setErrors(err.fields || {});
      setMessage(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Sign in" subtitle="Use your administrator account.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {message && !Object.keys(errors).length && <Alert>{message}</Alert>}
        <Field label="Email address" type="email" required autoFocus autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
        <Field label="Password" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} />
        <Button type="submit" loading={busy} className="min-h-11 w-full">Sign in</Button>
      </form>
    </AuthFrame>
  );
}
