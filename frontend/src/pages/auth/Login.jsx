import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { email, required, useValidation } from '../../lib/validation';
import { Alert, Button, Field, usePageTitle } from '../../components/ui';
import AuthShell from './AuthShell';

const RULES = {
  email: [required('Enter your email address'), email()],
  password: [required('Enter your password')],
};

export default function Login() {
  usePageTitle('Sign in');
  const { login } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userEdited, setUserEdited] = useState(false);
  const v = useValidation(RULES, form);

  useEffect(() => {
    // Ensure form fields start completely empty and clear browser auto-population
    setForm({ email: '', password: '' });
    const timer = setTimeout(() => {
      if (!userEdited) {
        setForm({ email: '', password: '' });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const set = (key) => (e) => {
    setUserEdited(true);
    if (key === 'email') setAccountNotFound(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    setAccountNotFound(false);
    if (!v.check()) return;
    setBusy(true);
    try {
      const user = await login(form);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      // the route guard now redirects to where the visitor was heading
    } catch (err) {
      v.setServerErrors(err.fields);
      if (err.status === 404 || err.details?.notFound) {
        setAccountNotFound(true);
      } else if (!Object.keys(err.fields || {}).length) {
        setMessage(err.message);
      }
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to track orders and check out faster."
      footer={<>New to Sannara? <Link to="/register" state={{ ...location.state, email: form.email }} data-no-transition className="link">Create an account</Link></>}
    >
      <form onSubmit={submit} noValidate autoComplete="off" className="space-y-4">
        {/* Decoy inputs to capture unwanted browser auto-fill */}
        <input
          type="text"
          name="fake_user_prevent_autofill"
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1, pointerEvents: 'none' }}
          readOnly
        />
        <input
          type="password"
          name="fake_pass_prevent_autofill"
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="new-password"
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1, pointerEvents: 'none' }}
          readOnly
        />

        {location.state?.resetSuccess ? (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-sm text-emerald-950 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-lg leading-none" aria-hidden>✅</span>
              <div>
                <p className="font-semibold text-emerald-950">Password updated successfully!</p>
                <p className="text-xs text-emerald-800 mt-0.5">Please enter your email and new password to sign in.</p>
              </div>
            </div>
          </div>
        ) : null}

        {accountNotFound ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-sm animate-fade-in">
            <div className="flex items-start gap-2.5">
              <span className="text-lg leading-none" aria-hidden>⚠️</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-950">Account not found</p>
                <p className="mt-1 text-[13px] text-amber-800 leading-snug">
                  No account was found with <strong>{form.email}</strong>. Please create a new account to continue.
                </p>
                <div className="mt-3">
                  <Link
                    to="/register"
                    state={{ ...location.state, email: form.email }}
                    data-no-transition
                    className="inline-flex items-center gap-1.5 rounded-lg bg-pine-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-pine-900 transition-colors"
                  >
                    Create new account →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : message ? (
          <Alert>{message}</Alert>
        ) : null}
        <Field
          label="Email address"
          type="email"
          required
          value={form.email}
          onChange={set('email')}
          {...v.bind('email')}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          autoFocus
        />
        <Field
          label="Password"
          type="password"
          required
          value={form.password}
          onChange={set('password')}
          {...v.bind('password')}
          autoComplete="new-password"
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="link inline-flex min-h-9 items-center text-sm">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
      </form>
    </AuthShell>
  );
}
