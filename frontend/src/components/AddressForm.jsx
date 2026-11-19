import { useMemo, useState } from 'react';
import api from '../lib/api';
import { COUNTRIES, getCountry } from '../lib/countries';
import { minLength, onlyDigits, required, useValidation } from '../lib/validation';
import { Alert, Button, Field, cx } from './ui';

const EMPTY = {
  label: 'Home',
  full_name: '',
  country: 'India',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: 'Tamil Nadu',
  pincode: '',
  is_default: false,
};

/** Create or edit a delivery address (Domestic & International with country-level validation). */
export default function AddressForm({ address, defaultName = '', defaultPhone = '', onSaved, onCancel }) {
  const [form, setForm] = useState(() => {
    if (address) {
      return {
        ...EMPTY,
        ...address,
        country: address.country || 'India',
        line2: address.line2 || '',
        is_default: !!address.is_default,
      };
    }
    return {
      ...EMPTY,
      full_name: defaultName,
      phone: defaultPhone || '',
    };
  });

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedCountry = useMemo(() => getCountry(form.country), [form.country]);

  const rules = useMemo(() => ({
    full_name: [required('Enter the name of the person receiving the order'), minLength(2, 'Enter the full name')],
    country: [required('Choose a country / region')],
    phone: [
      required('Enter a mobile number for delivery updates'),
      (value) => {
        const d = String(value || '').replace(/\D/g, '');
        if (!d) return 'Enter a mobile number';
        if (!selectedCountry.validatePhone(d)) {
          return selectedCountry.phoneError;
        }
        return '';
      },
    ],
    line1: [required('Enter the house number and street'), minLength(5, 'Add a little more detail so the courier can find you')],
    city: [required('Enter the city or town'), minLength(2, 'Enter the city or town')],
    pincode: [
      ...(selectedCountry.postalRequired ? [required(`Enter the ${selectedCountry.postalLabel}`)] : []),
      (value) => {
        if (!value && !selectedCountry.postalRequired) return '';
        if (!selectedCountry.validatePostal(value)) {
          return selectedCountry.postalError;
        }
        return '';
      },
    ],
    state: [
      required(selectedCountry.states ? 'Choose a state / region' : 'Enter the state / province / region'),
      minLength(2, 'Enter the state / province / region'),
    ],
  }), [selectedCountry]);

  const v = useValidation(rules, form);

  const onCountryChange = (e) => {
    const nextCountryName = e.target.value;
    const nextCountry = getCountry(nextCountryName);
    setForm((f) => {
      let nextState = f.state;
      if (nextCountry.states) {
        if (!nextCountry.states.includes(nextState)) {
          nextState = nextCountry.states[0] || '';
        }
      } else {
        nextState = '';
      }
      return {
        ...f,
        country: nextCountry.name,
        state: nextState,
        phone: onlyDigits(f.phone, nextCountry.phoneMaxDigits),
      };
    });
  };

  const set = (key) => (e) => {
    let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (key === 'phone') value = onlyDigits(value, selectedCountry.phoneMaxDigits);
    if (key === 'pincode' && selectedCountry.code === 'IN') value = onlyDigits(value, 6);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // this form can sit inside the checkout page
    setMessage('');
    if (!v.check()) return;
    setBusy(true);
    try {
      const payload = {
        ...form,
        full_name: form.full_name.trim(),
        country: form.country.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
      };
      const d = address ? await api.put(`/addresses/${address.id}`, payload) : await api.post('/addresses', payload);
      onSaved(d.addresses);
    } catch (err) {
      v.setServerErrors(err.fields);
      if (!Object.keys(err.fields || {}).length) setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      {message && <Alert className="sm:col-span-2">{message}</Alert>}

      <fieldset className="sm:col-span-2">
        <legend className="label">Address type</legend>
        <div className="flex gap-2">
          {['Home', 'Work', 'Other'].map((label) => (
            <label key={label} className={cx('chip has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600', form.label === label && 'chip-active')}>
              <input type="radio" name="label" value={label} checked={form.label === label} onChange={set('label')} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Country / Region dropdown */}
      <Field
        className="sm:col-span-2"
        label="Country / Region"
        required
        as="select"
        value={form.country}
        onChange={onCountryChange}
        {...v.bind('country')}
        autoComplete="country-name"
      >
        {COUNTRIES.map((c) => (
          <option key={c.name} value={c.name}>
            {c.flag} {c.name} {c.dialCode ? `(${c.dialCode})` : ''}
          </option>
        ))}
      </Field>

      <Field label="Full name" required value={form.full_name} onChange={set('full_name')} {...v.bind('full_name')} autoComplete="name" />

      {/* Mobile number with dynamic country dial code */}
      <Field
        label="Mobile number"
        required
        type="tel"
        inputMode="numeric"
        prefix={selectedCountry.dialCode}
        value={form.phone}
        onChange={set('phone')}
        {...v.bind('phone')}
        autoComplete="tel-national"
        placeholder={selectedCountry.phonePlaceholder}
        hint={selectedCountry.dialCode ? `Dial code: ${selectedCountry.dialCode}` : undefined}
      />

      <Field className="sm:col-span-2" label="House no., building, street" required value={form.line1} onChange={set('line1')} {...v.bind('line1')} autoComplete="address-line1" />
      <Field className="sm:col-span-2" label="Area, landmark (optional)" value={form.line2} onChange={set('line2')} autoComplete="address-line2" />

      <Field label="City" required value={form.city} onChange={set('city')} {...v.bind('city')} autoComplete="address-level2" />

      {/* PIN / ZIP / Postal code with country specific validation */}
      <Field
        label={selectedCountry.postalLabel}
        required={selectedCountry.postalRequired}
        inputMode={selectedCountry.code === 'IN' || selectedCountry.code === 'SG' ? 'numeric' : 'text'}
        value={form.pincode}
        onChange={set('pincode')}
        {...v.bind('pincode')}
        autoComplete="postal-code"
        placeholder={selectedCountry.postalPlaceholder}
      />

      {/* State: Dropdown for countries with preset states, or text input for international */}
      {selectedCountry.states ? (
        <Field className="sm:col-span-2" label="State / Province" required as="select" value={form.state} onChange={set('state')} {...v.bind('state')} autoComplete="address-level1">
          {selectedCountry.states.map((s) => <option key={s} value={s}>{s}</option>)}
        </Field>
      ) : (
        <Field className="sm:col-span-2" label="State / Province / Region" required value={form.state} onChange={set('state')} {...v.bind('state')} autoComplete="address-level1" placeholder="e.g. England, Greater London, Bavaria" />
      )}

      <label className="flex min-h-11 items-center gap-3 text-[15px] sm:col-span-2">
        <input type="checkbox" checked={form.is_default} onChange={set('is_default')} className="size-[18px] rounded accent-brand-600" />
        Make this my default address
      </label>

      <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={busy}>{address ? 'Save changes' : 'Save address'}</Button>
      </div>
    </form>
  );
}
