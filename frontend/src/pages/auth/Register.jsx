import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { email, matches, minLength, onlyDigits, password, phone, required, useValidation } from '../../lib/validation';
import { Alert, Button, Field, usePageTitle } from '../../components/ui';
import AuthShell from './AuthShell';

const RULES = {
  name: [required('Enter your full name'), minLength(2, 'Enter your full name')],
  email: [required('Enter your email address'), email()],
  phone: [required('Enter your mobile number'), phone()],
  password: [required('Choose a password'), password()],
  confirm: [required('Type the password again'), matches('password', 'Passwords do not match')],
};

export default function Register() {
  usePageTitle('Create account');
  const { register } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [form, setForm] = useState({
    name: '',
    email: location.state?.email || '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const v = useValidation(RULES, form);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: key === 'phone' ? onlyDigits(e.target.value, 10) : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!v.check()) return;
    setBusy(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone, password: form.password });
      toast.success('Your account is ready. Welcome!');
    } catch (err) {
      v.setServerErrors(err.fields);
      // "email already registered" belongs next to the email box
      if (err.status === 409) v.setServerErrors({ email: err.message });
      else if (!Object.keys(err.fields || {}).length) setMessage(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Save addresses, track orders and keep a wishlist."
      footer={<>Already have an account? <Link to="/login" state={location.state} data-no-transition className="link">Sign in</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {message && <Alert>{message}</Alert>}
        <Field label="Full name" required value={form.name} onChange={set('name')} {...v.bind('name')} autoComplete="name" autoFocus />
        <Field label="Email address" type="email" required value={form.email} onChange={set('email')} {...v.bind('email')} autoComplete="email" />
        <Field label="Mobile number" type="tel" inputMode="numeric" required value={form.phone} onChange={set('phone')} {...v.bind('phone')} autoComplete="tel-national" placeholder="10-digit number" />
        <Field label="Password" type="password" required value={form.password} onChange={set('password')} {...v.bind('password')} autoComplete="new-password" hint="At least 8 characters, with a letter and a number." />
        <Field label="Confirm password" type="password" required value={form.confirm} onChange={set('confirm')} {...v.bind('confirm')} autoComplete="new-password" />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
        <p className="text-center text-[13px] leading-relaxed text-ink-400">
          By creating an account you agree to our <Link to="/terms-and-conditions" className="underline underline-offset-2">Terms</Link> and <Link to="/privacy-policy" className="underline underline-offset-2">Privacy policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}
